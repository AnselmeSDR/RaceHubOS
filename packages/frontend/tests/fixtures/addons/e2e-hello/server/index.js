// Mounted at /api/addons/e2e-hello
export default function register(ctx) {
  ctx.router.get('/hello', (req, res) => res.json({ from: ctx.id, core: ctx.version }))
}
