import { SdkNode, BurnRequest, BurnResponse } from '../index'

declare const node: SdkNode
const request: BurnRequest = {
  asset_id: 'rgb:test',
  amount: '18446744073709551615',
  fee_rate: 1,
  min_confirmations: 1,
  burn_recipient: 'ab'.repeat(32)
}
const result: BurnResponse = node.burn(request)
const alias: BurnResponse = node.burnAsset({ ...request, burn_recipient: null })
const txid: string = result.txid
const batch: number = alias.batch_transfer_idx
void txid
void batch
// @ts-expect-error Confirmation counts are numeric u8 values.
node.burn({ ...request, min_confirmations: '1' })
// @ts-expect-error The recipient is hex text, not a byte array.
node.burnAsset({ ...request, burn_recipient: new Uint8Array(32) })
// @ts-expect-error Decimal strings must be integer text.
node.burn({ ...request, amount: '1.5' })
