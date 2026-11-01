import { prepareHomeMigration, verifyHomeMigration, finalizeHomeMigration } from './home-migration.mjs';
try {
  const command = process.argv[2] ?? 'prepare';
  const result = command === 'prepare' ? await prepareHomeMigration() : command === 'verify' ? await verifyHomeMigration() : command === 'finalize' ? await finalizeHomeMigration(process.env, { userValidated: process.argv.includes('--confirm-user-validation') }) : null;
  if (!result) throw Error('Use prepare, verify, or finalize --confirm-user-validation.');
  console.log(JSON.stringify(result));
} catch (error) { console.error('JobTrack data migration: ' + error.message); process.exitCode = 1; }
