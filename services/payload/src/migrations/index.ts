import * as migration_20261113_185307_initial from './20261113_185307_initial';

export const migrations = [
  {
    up: migration_20261113_185307_initial.up,
    down: migration_20261113_185307_initial.down,
    name: '20261113_185307_initial'
  },
];
