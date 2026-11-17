import * as billing from './20261116_150000_billing';
import * as modules from './20261116_120000_modules';
import * as migration_20261113_185307_initial from './20261113_185307_initial';

export const migrations = [
  {
    up: migration_20261113_185307_initial.up,
    down: migration_20261113_185307_initial.down,
    name: '20261113_185307_initial'
  },
  { up: modules.up, down: modules.down, name: '20261116_120000_modules' },
 {up:billing.up,down:billing.down,name:'20261116_150000_billing'},
];
