const { execSync } = require('child_process');
for (let i = 0; i < 4; i++) {
  try {
    console.log(execSync('cmd.exe /c "npx convex run admin/removeProfileImages:removeBatch"').toString());
  } catch (e) {
    console.error(e.message);
  }
}
