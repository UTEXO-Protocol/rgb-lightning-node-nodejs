// Copyright 2026 UTEXO.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

//! Node-API bindings for rgb-lightning-node.
//!
//! Mirrors the bare addon's JS surface (`SdkNode`, `NativeExternalSigner`,
//! module-level helpers) so the WDK layer can switch implementations
//! purely by import path. Internally we reuse the `extern "C"` shims
//! exported by `rln-c-ffi`; each napi method (a) serialises its request
//! argument to a C string, (b) calls the matching `rln_*` function,
//! (c) parses the `CResultString` back into JS — either a returned
//! string (most methods return JSON) or a thrown `napi::Error` (the
//! `CResultValue::Err` branch).

#![deny(clippy::all)]

use std::ffi::{CStr, CString};

use napi::{bindgen_prelude::*, Error as NapiError};
use napi_derive::napi;

use rlncffi::{
    free_native_external_signer, free_sdk_node, rln_address, rln_asset_balance,
    rln_btc_balance, rln_close_channel, rln_connect_peer, rln_create_utxos,
    rln_decode_ln_invoice, rln_disconnect_peer, rln_free_string,
    rln_issue_asset_nia, rln_keysend, rln_list_assets, rln_list_channels,
    rln_list_payments, rln_list_peers, rln_list_transfers, rln_list_unspents,
    rln_ln_invoice, rln_native_external_signer_bootstrap,
    rln_native_external_signer_new, rln_network_info, rln_node_info,
    rln_open_channel, rln_refresh_transfers, rln_rgb_invoice,
    rln_sdk_node_attach_native_external_signer,
    rln_sdk_node_detach_external_signer,
    rln_sdk_node_init_with_external_signer,
    rln_sdk_node_init_with_native_external_signer, rln_sdk_node_new,
    rln_sdk_node_shutdown,
    rln_sdk_node_unlock_with_attached_external_signer,
    rln_sdk_node_unlock_with_native_external_signer, rln_send_btc,
    rln_send_payment, rln_send_rgb, rln_sync, COpaqueStruct, CResult,
    CResultString, CResultValue,
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/// CString from a Rust string (input is always JS-supplied, so panicking
/// on interior NULs would be a bug in the caller — we map it to a napi
/// error instead).
fn cstring(s: &str) -> Result<CString> {
    CString::new(s).map_err(|e| NapiError::from_reason(format!("invalid string: {e}")))
}

/// Consumes a `CResultString` from the C-FFI and returns either the
/// inner JSON `String` (Ok) or maps the error message into a napi
/// error (Err). In both cases the C-allocated buffer is freed.
fn take_cresult_string(res: CResultString) -> Result<String> {
    let CResultString { result, inner } = res;
    let s = unsafe {
        if inner.is_null() {
            String::new()
        } else {
            let owned = CStr::from_ptr(inner).to_string_lossy().into_owned();
            rln_free_string(inner);
            owned
        }
    };
    match result {
        CResultValue::Ok => Ok(s),
        CResultValue::Err => Err(NapiError::from_reason(s)),
    }
}

// ---------------------------------------------------------------------------
// NativeExternalSigner — VLS in-process signer
// ---------------------------------------------------------------------------

#[napi]
pub struct NativeExternalSigner {
    handle: COpaqueStruct,
}

impl Drop for NativeExternalSigner {
    fn drop(&mut self) {
        unsafe {
            free_native_external_signer(std::mem::replace(
                &mut self.handle,
                COpaqueStruct::null(),
            ));
        }
    }
}

#[napi]
impl NativeExternalSigner {
    /// `seedHex` is the 32-byte VLS node entropy as a 64-char hex
    /// string. `network` is one of `mainnet|testnet|regtest|signet`.
    #[napi(factory)]
    pub fn create(
        seed_hex: String,
        network: String,
        permissive_signer_policy: bool,
    ) -> Result<Self> {
        let seed_c = cstring(&seed_hex)?;
        let net_c = cstring(&network)?;
        let res = unsafe {
            rln_native_external_signer_new(seed_c.as_ptr(), net_c.as_ptr(), permissive_signer_policy)
        };
        match res.result {
            CResultValue::Ok => Ok(Self { handle: res.inner }),
            CResultValue::Err => {
                // Err branch: `inner.ptr` is a *mut c_char with the message.
                let msg = unsafe {
                    let p = res.inner.as_err_string_ptr();
                    let s = CStr::from_ptr(p).to_string_lossy().into_owned();
                    rln_free_string(p);
                    s
                };
                Err(NapiError::from_reason(msg))
            }
        }
    }

    /// Returns the bootstrap dictionary (node_id, xpubs, master fingerprint)
    /// as a JSON string. JS callers `JSON.parse` it.
    #[napi]
    pub fn bootstrap(&self) -> Result<String> {
        let res = unsafe { rln_native_external_signer_bootstrap(&self.handle) };
        take_cresult_string(res)
    }

    /// Explicit early-drop; safe to call multiple times. Mostly a hook
    /// for tests — Rust's `Drop` impl handles normal cleanup.
    #[napi]
    pub fn destroy(&mut self) {
        unsafe {
            free_native_external_signer(std::mem::replace(
                &mut self.handle,
                COpaqueStruct::null(),
            ));
        }
    }
}

// ---------------------------------------------------------------------------
// SdkNode — LDK + RLN handle
// ---------------------------------------------------------------------------

#[napi]
pub struct SdkNode {
    handle: COpaqueStruct,
}

impl Drop for SdkNode {
    fn drop(&mut self) {
        unsafe {
            free_sdk_node(std::mem::replace(&mut self.handle, COpaqueStruct::null()));
        }
    }
}

/// Boilerplate-thin wrapper: forward a single JSON request to a C-FFI
/// function with signature `fn(&COpaqueStruct, *const c_char) -> CResultString`.
macro_rules! fwd_json_req {
    ($self:ident, $func:ident, $req:ident) => {{
        let req_c = cstring(&$req)?;
        let res = unsafe { $func(&$self.handle, req_c.as_ptr()) };
        take_cresult_string(res)
    }};
}

/// `fn(&COpaqueStruct) -> CResultString` — no request argument.
macro_rules! fwd_noarg {
    ($self:ident, $func:ident) => {{
        let res = unsafe { $func(&$self.handle) };
        take_cresult_string(res)
    }};
}

#[napi]
impl SdkNode {
    /// Initial node construction. `requestJson` is a JsonSdkInitRequest
    /// (storage_dir_path, daemon_listening_port, network, …).
    #[napi(factory)]
    pub fn create(request_json: String) -> Result<Self> {
        let req_c = cstring(&request_json)?;
        let res = unsafe { rln_sdk_node_new(req_c.as_ptr()) };
        match res.result {
            CResultValue::Ok => Ok(Self { handle: res.inner }),
            CResultValue::Err => {
                let msg = unsafe {
                    let p = res.inner.as_err_string_ptr();
                    let s = CStr::from_ptr(p).to_string_lossy().into_owned();
                    rln_free_string(p);
                    s
                };
                Err(NapiError::from_reason(msg))
            }
        }
    }

    // -- External-signer lifecycle ----------------------------------------

    #[napi]
    pub fn init_with_native_external_signer(&self, signer: &NativeExternalSigner) -> Result<()> {
        let res = unsafe {
            rln_sdk_node_init_with_native_external_signer(&self.handle, &signer.handle)
        };
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn unlock_with_native_external_signer(
        &self,
        signer: &NativeExternalSigner,
        request_json: String,
    ) -> Result<()> {
        let req_c = cstring(&request_json)?;
        let res = unsafe {
            rln_sdk_node_unlock_with_native_external_signer(
                &self.handle,
                &signer.handle,
                req_c.as_ptr(),
            )
        };
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn init_with_external_signer(&self, request_json: String) -> Result<()> {
        let req_c = cstring(&request_json)?;
        let res = unsafe { rln_sdk_node_init_with_external_signer(&self.handle, req_c.as_ptr()) };
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn attach_native_external_signer(&self, signer: &NativeExternalSigner) -> Result<()> {
        let res = unsafe {
            rln_sdk_node_attach_native_external_signer(&self.handle, &signer.handle)
        };
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn unlock_with_attached_external_signer(&self, request_json: String) -> Result<()> {
        let req_c = cstring(&request_json)?;
        let res = unsafe {
            rln_sdk_node_unlock_with_attached_external_signer(&self.handle, req_c.as_ptr())
        };
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn detach_external_signer(&self) -> Result<()> {
        let res = unsafe { rln_sdk_node_detach_external_signer(&self.handle) };
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn shutdown(&self) -> Result<()> {
        let res = unsafe { rln_sdk_node_shutdown(&self.handle) };
        take_cresult_string(res).map(|_| ())
    }

    // -- Node info / sync --------------------------------------------------

    #[napi]
    pub fn node_info(&self) -> Result<String> { fwd_noarg!(self, rln_node_info) }
    #[napi]
    pub fn network_info(&self) -> Result<String> { fwd_noarg!(self, rln_network_info) }
    #[napi]
    pub fn sync(&self) -> Result<String> { fwd_noarg!(self, rln_sync) }

    // -- Peers / channels --------------------------------------------------

    #[napi]
    pub fn connect_peer(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_connect_peer, request_json)
    }
    #[napi]
    pub fn disconnect_peer(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_disconnect_peer, request_json)
    }
    #[napi]
    pub fn list_peers(&self) -> Result<String> { fwd_noarg!(self, rln_list_peers) }

    #[napi]
    pub fn open_channel(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_open_channel, request_json)
    }
    #[napi]
    pub fn close_channel(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_close_channel, request_json)
    }
    #[napi]
    pub fn list_channels(&self) -> Result<String> { fwd_noarg!(self, rln_list_channels) }

    // -- BTC + UTXOs ------------------------------------------------------

    #[napi]
    pub fn get_address(&self) -> Result<String> { fwd_noarg!(self, rln_address) }

    /// `skipSync` mirrors the C-FFI `skip_sync` bool — `true` returns
    /// the cached balance without re-scanning electrum.
    #[napi]
    pub fn get_btc_balance(&self, skip_sync: bool) -> Result<String> {
        let res = unsafe { rln_btc_balance(&self.handle, skip_sync) };
        take_cresult_string(res)
    }

    #[napi]
    pub fn list_unspents(&self, skip_sync: bool) -> Result<String> {
        let res = unsafe { rln_list_unspents(&self.handle, skip_sync) };
        take_cresult_string(res)
    }

    #[napi]
    pub fn send_btc(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_send_btc, request_json)
    }
    #[napi]
    pub fn create_utxos(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_create_utxos, request_json)
    }

    // -- Lightning invoices / payments ------------------------------------

    #[napi]
    pub fn ln_invoice(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_ln_invoice, request_json)
    }
    #[napi]
    pub fn decode_ln_invoice(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_decode_ln_invoice, request_json)
    }
    #[napi]
    pub fn send_payment(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_send_payment, request_json)
    }
    #[napi]
    pub fn keysend(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_keysend, request_json)
    }
    #[napi]
    pub fn list_payments(&self) -> Result<String> { fwd_noarg!(self, rln_list_payments) }

    // -- RGB assets -------------------------------------------------------

    #[napi]
    pub fn issue_asset_nia(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_issue_asset_nia, request_json)
    }
    /// `filterAssetSchemasJson` is a JSON array of schema names to
    /// filter by (`["Nia", "Cfa", "Uda", "Ifa"]` for all). Empty array
    /// or `null` returns every asset.
    #[napi]
    pub fn list_assets(&self, filter_asset_schemas_json: String) -> Result<String> {
        fwd_json_req!(self, rln_list_assets, filter_asset_schemas_json)
    }
    /// `assetId` is the bare contract id ("rgb:..."), not a JSON request.
    #[napi]
    pub fn get_asset_balance(&self, asset_id: String) -> Result<String> {
        let s = cstring(&asset_id)?;
        let res = unsafe { rln_asset_balance(&self.handle, s.as_ptr()) };
        take_cresult_string(res)
    }
    #[napi]
    pub fn rgb_invoice(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_rgb_invoice, request_json)
    }
    #[napi]
    pub fn send_rgb(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_send_rgb, request_json)
    }
    /// Forces an electrum re-scan + rgb-lib reconciliation. Returns
    /// nothing — callers re-poll `get_asset_balance` afterwards.
    #[napi]
    pub fn refresh_transfers(&self, request_json: String) -> Result<()> {
        let req_c = cstring(&request_json)?;
        let res = unsafe { rln_refresh_transfers(&self.handle, req_c.as_ptr()) };
        take_cresult_string(res).map(|_| ())
    }
    #[napi]
    pub fn list_transfers(&self, asset_id: String) -> Result<String> {
        let s = cstring(&asset_id)?;
        let res = unsafe { rln_list_transfers(&self.handle, s.as_ptr()) };
        take_cresult_string(res)
    }
}

// ---------------------------------------------------------------------------
// Module-level helpers (mirror bare addon's healthcheck / global init)
// ---------------------------------------------------------------------------

// TODO: surface uniffiHealthcheck / uniffiIsInitialized / sdkInitialize /
// sdkShutdown once we decide whether to keep them static-lifetime. Bare
// addon exposes them today; current callers (BareRgbLightningBinding /
// NodeRgbLightningBinding) only use the instance methods so we can defer.
