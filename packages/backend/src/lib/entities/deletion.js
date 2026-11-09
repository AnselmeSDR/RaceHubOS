import { findOr404, route } from '../http.js';

/**
 * DELETE /:id and PATCH /:id/restore for an entity kept in the recycle bin: a first delete hides it
 * (`hide`, with what is recorded under it), a second erases it (`erase`); a restore brings back
 * what its deletion hid (`restore`). Each callback receives the entity's id.
 */
export function addDeletionRoutes(router, { name, model, hide, erase, restore }) {
  const label = name.toLowerCase();

  router.delete(
    '/:id',
    route(`Failed to delete ${label}`, async (req, res) => {
      const { id } = req.params;
      const row = await findOr404(model, id, name);
      await (row.deletedAt ? erase(id) : hide(id));
      res.json({ success: true, message: `${name} deleted successfully` });
    })
  );

  router.patch(
    '/:id/restore',
    route(`Failed to restore ${label}`, async (req, res) => {
      await findOr404(model, req.params.id, name);
      await restore(req.params.id);
      res.json({ success: true, message: `${name} restored` });
    })
  );
}
