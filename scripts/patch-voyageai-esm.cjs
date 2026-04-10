const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '..', 'node_modules', 'voyageai', 'package.json')
if (!fs.existsSync(pkgPath)) {
  console.log('[patch-voyageai-esm] voyageai not found, skipping patch')
  process.exit(0)
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
if (pkg.exports) {
  delete pkg.exports
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
  console.log('[patch-voyageai-esm] Patched voyageai ESM exports')
} else {
  console.log('[patch-voyageai-esm] No exports field found, skipping')
}
