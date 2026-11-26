import "server-only";
import { isDemoAccount } from "./demo-accounts";
import { demoCatalogue } from "./demo-catalogue";
import { aarlaCatalogue } from "./catalogue";
/** Demo browsing/saving never depends on or calls the live Shopify catalogue. */
export async function catalogueForAccount(accountId: string) {
  return isDemoAccount(accountId) ? demoCatalogue() : aarlaCatalogue();
}
