import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import Modal, { ModalFooter } from '@/components/ui/Modal'

/** Asks before uninstalling, and whether the add-on's data goes too (kept by default). */
export default function UninstallDialog({ name, onConfirm, onClose }) {
  const { t } = useTranslation('addons')
  const [deleteData, setDeleteData] = useState(false)

  return (
    <Modal open onClose={onClose} title={t('uninstall.title', { name })} icon={<Trash2 className="size-5" />}>
      <label className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          checked={deleteData}
          onCheckedChange={(checked) => setDeleteData(checked === true)}
          data-testid="uninstall-delete-data"
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">{t('uninstall.deleteData')}</span>
          <span className="block text-sm text-muted-foreground">{t('uninstall.deleteDataHint')}</span>
        </span>
      </label>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          {t('uninstall.cancel')}
        </Button>
        <Button variant="destructive" onClick={() => onConfirm({ deleteData })} data-testid="uninstall-confirm">
          {t('uninstall.confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
