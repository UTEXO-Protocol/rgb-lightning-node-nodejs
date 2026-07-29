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
    free_native_external_signer, free_sdk_node, rln_address, rln_asset_balance, rln_asset_metadata,
    rln_btc_balance, rln_cancel_btc_send_plan, rln_cancel_create_utxos_plan,
    rln_cancel_hodl_invoice, rln_cancel_rgb_send_plan, rln_check_indexer_url,
    rln_check_proxy_endpoint, rln_claim_hodl_invoice, rln_close_channel,
    rln_commit_prepared_btc_send, rln_commit_prepared_create_utxos, rln_commit_prepared_rgb_send,
    rln_connect_peer, rln_create_utxos, rln_decode_ln_invoice, rln_decode_rgb_invoice,
    rln_disconnect_peer, rln_estimate_fee, rln_fail_transfers, rln_free_string,
    rln_get_asset_media, rln_get_channel_id, rln_get_payment, rln_get_swap, rln_inflate,
    rln_invoice_status, rln_issue_asset_cfa, rln_issue_asset_ifa, rln_issue_asset_nia,
    rln_issue_asset_uda, rln_keysend, rln_list_address_receipts, rln_list_assets,
    rln_list_channels, rln_list_payments, rln_list_peers, rln_list_pending_rgb_send_plans,
    rln_list_pending_vanilla_transactions, rln_list_swaps, rln_list_transactions,
    rln_list_transactions_by_txid, rln_list_transfers, rln_list_transfers_by_txid,
    rln_list_unspents, rln_ln_invoice, rln_maker_execute, rln_maker_init,
    rln_native_external_signer_bootstrap, rln_native_external_signer_new,
    rln_native_external_signer_new_with_storage, rln_network_info, rln_node_info, rln_open_channel,
    rln_post_asset_media, rln_prepare_btc_send, rln_prepare_create_utxos, rln_prepare_rgb_send,
    rln_refresh_transfers, rln_rgb_invoice, rln_rotate_address, rln_sdk_node_apay_new,
    rln_sdk_node_attach_native_external_signer, rln_sdk_node_detach_external_signer,
    rln_sdk_node_init_with_external_signer, rln_sdk_node_init_with_native_external_signer,
    rln_sdk_node_adopt_native_operation, rln_sdk_node_cancel_native_operation,
    rln_sdk_node_native_operation_status, rln_sdk_node_new, rln_sdk_node_shutdown,
    rln_sdk_node_start_unlock_with_native_external_signer,
    rln_sdk_node_unlock_with_attached_external_signer,
    rln_sdk_node_unlock_with_native_external_signer, rln_sdk_node_vss_backup,
    rln_sdk_node_vss_clear_fence, rln_sdk_node_vss_delete_all, rln_send_btc,
    rln_send_onion_message, rln_send_payment,
    rln_send_rgb, rln_sign_message, rln_sync, rln_sync_wallet, rln_taker, rln_verify_message,
    rln_wallet_snapshot, COpaqueStruct, CResultString, CResultValue,
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
        free_native_external_signer(std::mem::replace(&mut self.handle, COpaqueStruct::null()));
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
        let res = rln_native_external_signer_new(
            seed_c.as_ptr(),
            net_c.as_ptr(),
            permissive_signer_policy,
        );
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

    /// Production constructor for a disk-backed VLS signer. The storage
    /// directory must be stable for the wallet identity so commitment state
    /// survives process restarts.
    #[napi(factory)]
    pub fn create_with_storage(
        seed_hex: String,
        network: String,
        storage_dir_path: String,
        permissive_signer_policy: bool,
    ) -> Result<Self> {
        let seed_c = cstring(&seed_hex)?;
        let net_c = cstring(&network)?;
        let storage_c = cstring(&storage_dir_path)?;
        let res = rln_native_external_signer_new_with_storage(
            seed_c.as_ptr(),
            net_c.as_ptr(),
            permissive_signer_policy,
            storage_c.as_ptr(),
        );
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

    /// Returns the bootstrap dictionary (node_id, xpubs, master fingerprint)
    /// as a JSON string. JS callers `JSON.parse` it.
    #[napi]
    pub fn bootstrap(&self) -> Result<String> {
        let res = rln_native_external_signer_bootstrap(&self.handle);
        take_cresult_string(res)
    }

    /// Explicit early-drop; safe to call multiple times. Mostly a hook
    /// for tests — Rust's `Drop` impl handles normal cleanup.
    #[napi]
    pub fn destroy(&mut self) {
        free_native_external_signer(std::mem::replace(&mut self.handle, COpaqueStruct::null()));
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
        free_sdk_node(std::mem::replace(&mut self.handle, COpaqueStruct::null()));
    }
}

/// Boilerplate-thin wrapper: forward a single JSON request to a C-FFI
/// function with signature `fn(&COpaqueStruct, *const c_char) -> CResultString`.
macro_rules! fwd_json_req {
    ($self:ident, $func:ident, $req:ident) => {{
        let req_c = cstring(&$req)?;
        let res = $func(&$self.handle, req_c.as_ptr());
        take_cresult_string(res)
    }};
}

/// `fn(&COpaqueStruct) -> CResultString` — no request argument.
macro_rules! fwd_noarg {
    ($self:ident, $func:ident) => {{
        let res = $func(&$self.handle);
        take_cresult_string(res)
    }};
}

/// `fn(&COpaqueStruct, *const c_char) -> CResultString` — single
/// raw-string argument (asset id, invoice, hex blob, …). Distinct
/// from `fwd_json_req!` only in name; both have the same body but
/// keeping them split documents intent at the call site.
macro_rules! fwd_str_arg {
    ($self:ident, $func:ident, $arg:ident) => {{
        let arg_c = cstring(&$arg)?;
        let res = $func(&$self.handle, arg_c.as_ptr());
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
        let res = rln_sdk_node_new(req_c.as_ptr());
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
        let res = rln_sdk_node_init_with_native_external_signer(&self.handle, &signer.handle);
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn unlock_with_native_external_signer(
        &self,
        signer: &NativeExternalSigner,
        request_json: String,
    ) -> Result<()> {
        let req_c = cstring(&request_json)?;
        let res = rln_sdk_node_unlock_with_native_external_signer(
            &self.handle,
            &signer.handle,
            req_c.as_ptr(),
        );
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn start_unlock_with_native_external_signer(
        &self,
        signer: &NativeExternalSigner,
        request_json: String,
    ) -> Result<String> {
        let req_c = cstring(&request_json)?;
        take_cresult_string(rln_sdk_node_start_unlock_with_native_external_signer(
            &self.handle,
            &signer.handle,
            req_c.as_ptr(),
        ))
    }

    #[napi]
    pub fn native_operation_status(&self, operation_id: String) -> Result<String> {
        let operation_id = cstring(&operation_id)?;
        take_cresult_string(rln_sdk_node_native_operation_status(
            &self.handle,
            operation_id.as_ptr(),
        ))
    }

    #[napi]
    pub fn adopt_native_operation(&self, operation_id: String) -> Result<String> {
        let operation_id = cstring(&operation_id)?;
        take_cresult_string(rln_sdk_node_adopt_native_operation(
            &self.handle,
            operation_id.as_ptr(),
        ))
    }

    #[napi]
    pub fn cancel_native_operation(&self, operation_id: String) -> Result<String> {
        let operation_id = cstring(&operation_id)?;
        take_cresult_string(rln_sdk_node_cancel_native_operation(
            &self.handle,
            operation_id.as_ptr(),
        ))
    }

    #[napi]
    pub fn init_with_external_signer(&self, request_json: String) -> Result<()> {
        let req_c = cstring(&request_json)?;
        let res = rln_sdk_node_init_with_external_signer(&self.handle, req_c.as_ptr());
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn attach_native_external_signer(&self, signer: &NativeExternalSigner) -> Result<()> {
        let res = rln_sdk_node_attach_native_external_signer(&self.handle, &signer.handle);
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn unlock_with_attached_external_signer(&self, request_json: String) -> Result<()> {
        let req_c = cstring(&request_json)?;
        let res = rln_sdk_node_unlock_with_attached_external_signer(&self.handle, req_c.as_ptr());
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn detach_external_signer(&self) -> Result<()> {
        let res = rln_sdk_node_detach_external_signer(&self.handle);
        take_cresult_string(res).map(|_| ())
    }

    #[napi]
    pub fn shutdown(&mut self) -> Result<()> {
        let res = rln_sdk_node_shutdown(&self.handle);
        let result = take_cresult_string(res).map(|_| ());
        free_sdk_node(std::mem::replace(&mut self.handle, COpaqueStruct::null()));
        result
    }

    /// Take over a stale VSS ownership fence after the previous node died
    /// holding it. Request JSON: `{"password": "..."}`. Throws
    /// `Rln(FailedVssInit)` if VSS isn't configured / the takeover fails.
    #[napi]
    pub fn vss_clear_fence(&self, request_json: String) -> Result<()> {
        let c = std::ffi::CString::new(request_json)
            .map_err(|_| napi::Error::from_reason("request contains null byte"))?;
        let res = rln_sdk_node_vss_clear_fence(&self.handle, c.as_ptr());
        take_cresult_string(res).map(|_| ())
    }

    /// Force an immediate VSS backup flush. Returns `{"version": i64}` JSON
    /// where version is the snapshot index just persisted. Throws
    /// `Rln(FailedVssInit)` if VSS isn't configured / the flush fails.
    /// Use for app-controlled checkpoints (e.g. save state before app
    /// suspend) rather than relying on the implicit on-write flush.
    #[napi]
    pub fn vss_backup(&self) -> Result<String> {
        let res = rln_sdk_node_vss_backup(&self.handle);
        take_cresult_string(res)
    }

    #[napi]
    pub fn vss_delete_all(&self, request_json: String) -> Result<String> {
        let request = std::ffi::CString::new(request_json)
            .map_err(|_| napi::Error::from_reason("request contains null byte"))?;
        let result = rln_sdk_node_vss_delete_all(&self.handle, request.as_ptr());
        take_cresult_string(result)
    }

    /// APay receiver-side registration with an LSP. Pass the LSP's node_id
    /// as a hex string. Returns the JSON `AsyncOrderNewResponse`. Upstream
    /// PR #51.
    #[napi]
    pub fn apay_new(&self, host_node_id: String) -> Result<String> {
        let c = std::ffi::CString::new(host_node_id)
            .map_err(|_| napi::Error::from_reason("host_node_id contains null byte"))?;
        let res = rln_sdk_node_apay_new(&self.handle, c.as_ptr());
        take_cresult_string(res)
    }

    // -- Node info / sync --------------------------------------------------

    #[napi]
    pub fn node_info(&self) -> Result<String> {
        fwd_noarg!(self, rln_node_info)
    }
    #[napi]
    pub fn network_info(&self) -> Result<String> {
        fwd_noarg!(self, rln_network_info)
    }
    #[napi]
    pub fn sync(&self) -> Result<String> {
        fwd_noarg!(self, rln_sync)
    }

    /// Synchronize both Vanilla BTC and Colored RGB keychains. Routine mode
    /// uses FullSync; recovery mode uses FullScan for address discovery.
    #[napi]
    pub fn sync_wallet(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_sync_wallet, request_json)
    }

    /// Capture a versioned, bounded, decimal-safe wallet snapshot from the
    /// native runtime without triggering an implicit synchronization.
    #[napi]
    pub fn wallet_snapshot(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_wallet_snapshot, request_json)
    }

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
    pub fn list_peers(&self) -> Result<String> {
        fwd_noarg!(self, rln_list_peers)
    }

    #[napi]
    pub fn open_channel(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_open_channel, request_json)
    }
    #[napi]
    pub fn close_channel(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_close_channel, request_json)
    }
    #[napi]
    pub fn list_channels(&self) -> Result<String> {
        fwd_noarg!(self, rln_list_channels)
    }
    /// `temporaryChannelIdHex` is the 64-char hex temp id returned by
    /// `openChannel`; this resolves it to the permanent channel id once
    /// the funding tx confirms.
    #[napi]
    pub fn get_channel_id(&self, temporary_channel_id_hex: String) -> Result<String> {
        fwd_str_arg!(self, rln_get_channel_id, temporary_channel_id_hex)
    }

    // -- BTC + UTXOs ------------------------------------------------------

    #[napi]
    pub fn get_address(&self) -> Result<String> {
        fwd_noarg!(self, rln_address)
    }

    #[napi]
    pub fn rotate_address(&self) -> Result<String> {
        fwd_noarg!(self, rln_rotate_address)
    }

    /// `skipSync` mirrors the C-FFI `skip_sync` bool — `true` returns
    /// the cached balance without re-scanning electrum.
    #[napi]
    pub fn get_btc_balance(&self, skip_sync: bool) -> Result<String> {
        let res = rln_btc_balance(&self.handle, skip_sync);
        take_cresult_string(res)
    }

    #[napi]
    pub fn list_unspents(&self, skip_sync: bool) -> Result<String> {
        let res = rln_list_unspents(&self.handle, skip_sync);
        take_cresult_string(res)
    }

    #[napi]
    pub fn send_btc(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_send_btc, request_json)
    }

    #[napi]
    pub fn prepare_btc_send(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_prepare_btc_send, request_json)
    }

    #[napi]
    pub fn commit_prepared_btc_send(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_commit_prepared_btc_send, request_json)
    }

    #[napi]
    pub fn cancel_btc_send_plan(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_cancel_btc_send_plan, request_json)
    }

    #[napi]
    pub fn prepare_create_utxos(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_prepare_create_utxos, request_json)
    }

    #[napi]
    pub fn commit_prepared_create_utxos(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_commit_prepared_create_utxos, request_json)
    }

    #[napi]
    pub fn cancel_create_utxos_plan(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_cancel_create_utxos_plan, request_json)
    }

    #[napi]
    pub fn list_pending_vanilla_transactions(&self) -> Result<String> {
        fwd_noarg!(self, rln_list_pending_vanilla_transactions)
    }

    #[napi]
    pub fn list_address_receipts(&self, address: String) -> Result<String> {
        let address_c = cstring(&address)?;
        let res = rln_list_address_receipts(&self.handle, address_c.as_ptr());
        take_cresult_string(res)
    }

    #[napi]
    pub fn create_utxos(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_create_utxos, request_json)
    }
    #[napi]
    pub fn list_transactions(&self, skip_sync: bool) -> Result<String> {
        let res = rln_list_transactions(&self.handle, skip_sync);
        take_cresult_string(res)
    }

    #[napi]
    pub fn list_transactions_by_txid(&self, txid: String, skip_sync: bool) -> Result<String> {
        let txid_c = cstring(&txid)?;
        let res = rln_list_transactions_by_txid(&self.handle, txid_c.as_ptr(), skip_sync);
        take_cresult_string(res)
    }
    /// `blocks` ∈ [1..=65535]; returned JSON has `fee_rate` in sat/vB.
    #[napi]
    pub fn estimate_fee(&self, blocks: u32) -> Result<String> {
        let blocks_u16 = u16::try_from(blocks).map_err(|_| {
            NapiError::from_reason("estimateFee: blocks must fit in u16 (1..=65535)")
        })?;
        let res = rln_estimate_fee(&self.handle, blocks_u16);
        take_cresult_string(res)
    }

    // -- Lightning invoices / payments ------------------------------------

    #[napi]
    pub fn ln_invoice(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_ln_invoice, request_json)
    }
    /// C-FFI expects the raw BOLT11 string, not a JSON envelope.
    #[napi]
    pub fn decode_ln_invoice(&self, invoice: String) -> Result<String> {
        fwd_str_arg!(self, rln_decode_ln_invoice, invoice)
    }
    #[napi]
    pub fn invoice_status(&self, invoice: String) -> Result<String> {
        fwd_str_arg!(self, rln_invoice_status, invoice)
    }
    #[napi]
    pub fn cancel_hodl_invoice(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_cancel_hodl_invoice, request_json)
    }
    #[napi]
    pub fn claim_hodl_invoice(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_claim_hodl_invoice, request_json)
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
    pub fn list_payments(&self) -> Result<String> {
        fwd_noarg!(self, rln_list_payments)
    }
    /// `paymentType` is one of `"sent"` / `"received"` / `"swap"`.
    #[napi]
    pub fn get_payment(&self, payment_hash_hex: String, payment_type: String) -> Result<String> {
        let hash_c = cstring(&payment_hash_hex)?;
        let type_c = cstring(&payment_type)?;
        let res = rln_get_payment(&self.handle, hash_c.as_ptr(), type_c.as_ptr());
        take_cresult_string(res)
    }

    // -- RGB assets -------------------------------------------------------

    #[napi]
    pub fn issue_asset_nia(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_issue_asset_nia, request_json)
    }
    #[napi]
    pub fn issue_asset_uda(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_issue_asset_uda, request_json)
    }
    #[napi]
    pub fn issue_asset_cfa(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_issue_asset_cfa, request_json)
    }
    #[napi]
    pub fn issue_asset_ifa(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_issue_asset_ifa, request_json)
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
        fwd_str_arg!(self, rln_asset_balance, asset_id)
    }
    #[napi]
    pub fn asset_metadata(&self, asset_id: String) -> Result<String> {
        fwd_str_arg!(self, rln_asset_metadata, asset_id)
    }
    #[napi]
    pub fn rgb_invoice(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_rgb_invoice, request_json)
    }
    #[napi]
    pub fn decode_rgb_invoice(&self, invoice: String) -> Result<String> {
        fwd_str_arg!(self, rln_decode_rgb_invoice, invoice)
    }
    #[napi]
    pub fn send_rgb(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_send_rgb, request_json)
    }

    #[napi]
    pub fn prepare_rgb_send(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_prepare_rgb_send, request_json)
    }

    #[napi]
    pub fn commit_prepared_rgb_send(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_commit_prepared_rgb_send, request_json)
    }

    #[napi]
    pub fn cancel_rgb_send_plan(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_cancel_rgb_send_plan, request_json)
    }

    #[napi]
    pub fn list_pending_rgb_send_plans(&self) -> Result<String> {
        fwd_noarg!(self, rln_list_pending_rgb_send_plans)
    }
    /// Forces an electrum re-scan + rgb-lib reconciliation. Returns
    /// nothing — callers re-poll `get_asset_balance` afterwards.
    #[napi]
    pub fn refresh_transfers(&self, request_json: String) -> Result<()> {
        let req_c = cstring(&request_json)?;
        let res = rln_refresh_transfers(&self.handle, req_c.as_ptr());
        take_cresult_string(res).map(|_| ())
    }
    #[napi]
    pub fn fail_transfers(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_fail_transfers, request_json)
    }
    #[napi]
    pub fn inflate(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_inflate, request_json)
    }
    #[napi]
    pub fn list_transfers(&self, asset_id: String) -> Result<String> {
        fwd_str_arg!(self, rln_list_transfers, asset_id)
    }
    #[napi]
    pub fn list_transfers_by_txid(&self, txid: String) -> Result<String> {
        fwd_str_arg!(self, rln_list_transfers_by_txid, txid)
    }

    // -- Asset media ------------------------------------------------------

    #[napi]
    pub fn get_asset_media(&self, digest: String) -> Result<String> {
        fwd_str_arg!(self, rln_get_asset_media, digest)
    }
    #[napi]
    pub fn post_asset_media(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_post_asset_media, request_json)
    }

    // -- Signing / onion / diagnostics ------------------------------------

    /// Returns `{ signature: "..." }` — VLS signs in-process.
    #[napi]
    pub fn sign_message(&self, message: String) -> Result<String> {
        fwd_str_arg!(self, rln_sign_message, message)
    }
    #[napi]
    pub fn verify_message(&self, message: String, signature: String) -> Result<String> {
        let message_c = cstring(&message)?;
        let signature_c = cstring(&signature)?;
        let res = rln_verify_message(&self.handle, message_c.as_ptr(), signature_c.as_ptr());
        take_cresult_string(res)
    }
    #[napi]
    pub fn send_onion_message(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_send_onion_message, request_json)
    }
    #[napi]
    pub fn check_indexer_url(&self, indexer_url: String) -> Result<String> {
        fwd_str_arg!(self, rln_check_indexer_url, indexer_url)
    }
    #[napi]
    pub fn check_proxy_endpoint(&self, proxy_endpoint: String) -> Result<String> {
        fwd_str_arg!(self, rln_check_proxy_endpoint, proxy_endpoint)
    }

    // -- Atomic swaps (exposed for parity with bare; WDK does not surface) -

    #[napi]
    pub fn maker_init(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_maker_init, request_json)
    }
    #[napi]
    pub fn maker_execute(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_maker_execute, request_json)
    }
    #[napi]
    pub fn taker(&self, request_json: String) -> Result<String> {
        fwd_json_req!(self, rln_taker, request_json)
    }
    #[napi]
    pub fn list_swaps(&self) -> Result<String> {
        fwd_noarg!(self, rln_list_swaps)
    }
    #[napi]
    pub fn get_swap(&self, payment_hash: String, taker_flag: bool) -> Result<String> {
        let hash_c = cstring(&payment_hash)?;
        let res = rln_get_swap(&self.handle, hash_c.as_ptr(), taker_flag);
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
