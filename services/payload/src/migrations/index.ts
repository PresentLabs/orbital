import * as reservationCatalog from "./20261118_030000_reservations_catalog";
import * as moduleAudit from "./20261117_200000_module_audit";
import * as reservations from "./20261117_190000_reservations";
import * as moduleGrants from "./20261117_180000_module_grants";
import * as platform from "./20261117_150000_platform";
import * as billing from './20261116_150000_billing';
import * as modules from './20261116_120000_modules';
import * as migration_20261113_185307_initial from './20261113_185307_initial';

import * as reservationExtras from "./20261118_040000_reservations_extras";

import * as reservationImages from "./20261118_050000_reservations_images";

import * as reservationPackages from "./20261118_060000_reservations_packages";

import * as reservationPaymentHolds from "./20261118_070000_reservations_payment_holds";

export const migrations = [
  {
    up: migration_20261113_185307_initial.up,
    down: migration_20261113_185307_initial.down,
    name: '20261113_185307_initial'
  },
  { up: modules.up, down: modules.down, name: '20261116_120000_modules' },
 {up:billing.up,down:billing.down,name:'20261116_150000_billing'},
 { up: platform.up, down: platform.down, name: "20261117_150000_platform" },
 { up: moduleGrants.up, down: moduleGrants.down, name: "20261117_180000_module_grants" },
 { up: reservations.up, down: reservations.down, name: "20261117_190000_reservations" },
 { up: moduleAudit.up, down: moduleAudit.down, name: "20261117_200000_module_audit" },
 { up: reservationCatalog.up, down: reservationCatalog.down, name: "20261118_030000_reservations_catalog" },
 { up: reservationExtras.up, down: reservationExtras.down, name: "20261118_040000_reservations_extras" },
 { up: reservationImages.up, down: reservationImages.down, name: "20261118_050000_reservations_images" },
 { up: reservationPackages.up, down: reservationPackages.down, name: "20261118_060000_reservations_packages" },
 { up: reservationPaymentHolds.up, down: reservationPaymentHolds.down, name: "20261118_070000_reservations_payment_holds" },
];
