const { spawnSync } = require('child_process');

const res = spawnSync('npx', ['convex', 'run', '--inline-query', '"await ctx.action(api.candidates.backfillLocation.runCandidateLocationBackfillBatch, { batchSize: 10 })"'], {
  shell: true,
  encoding: 'utf8'
});

console.log("STDOUT:", res.stdout);
console.log("STDERR:", res.stderr);
