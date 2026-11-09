/** A refusal a route answers with `status` and the error's message (404 not found, 400 bad input…). */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Wraps an async route handler. A thrown `HttpError` answers its status and message; any other
 * error is logged and answers `status` (500 by default) with `failure`, or the error's own message
 * when `failure` is null.
 */
export const route =
  (failure, handler, status = 500) =>
  async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof HttpError) return res.status(error.status).json({ success: false, error: error.message });
      console.error(`${req.method} ${req.originalUrl} failed:`, error);
      res.status(status).json({ success: false, error: failure ?? error.message });
    }
  };

/** The `model` row `id` (with `include`), or a 404 `<name> not found`. */
export async function findOr404(model, id, name, include) {
  const row = await model.findUnique({ where: { id }, include });
  if (!row) throw new HttpError(404, `${name} not found`);
  return row;
}
