import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const API = `${import.meta.env.VITE_API_URL || ''}/api/data/cockpit`
const groups = ['drivers', 'cars', 'tracks', 'sessions', 'results', 'laps']
function label(row) {
  return row.data.name || [row.data.brand, row.data.model].filter(Boolean).join(' ') || row.key.slice(0, 10)
}
function Field({ field, value, rows, busy, onChange, t }) {
  if (field.type === 'boolean')
    return (
      <Checkbox aria-label={t(`fields.${field.name}`)} checked={!!value} disabled={busy} onCheckedChange={onChange} />
    )
  if (field.type === 'reference' || field.type === 'choice') {
    const options =
      field.type === 'reference'
        ? rows[field.group].map((row) => ({ value: row.key, label: label(row) }))
        : field.values.map((value) => ({ value, label: t(`types.${value}`) }))
    return (
      <Select
        disabled={busy}
        value={value || '__empty'}
        onValueChange={(value) => onChange(value === '__empty' ? '' : value)}
      >
        <SelectTrigger aria-label={t(`fields.${field.name}`)} className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty">{t('unresolved')}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return (
    <Input
      aria-label={t(`fields.${field.name}`)}
      type={['integer', 'number'].includes(field.type) ? 'number' : 'text'}
      step={field.type === 'integer' ? '1' : 'any'}
      min={field.min}
      max={field.max}
      required={field.required}
      className="min-w-36"
      value={value ?? ''}
      disabled={busy}
      onChange={(event) =>
        onChange(
          ['integer', 'number'].includes(field.type)
            ? event.target.value === ''
              ? null
              : Number(event.target.value)
            : event.target.value
        )
      }
    />
  )
}
export default function Import() {
  const { t } = useTranslation('cockpit')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [message, setMessage] = useState('')
  const [completed, setCompleted] = useState(false)
  const [activeGroup, setActiveGroup] = useState('drivers')
  const [pages, setPages] = useState({})
  const pageSize = 25
  async function run(action) {
    setBusy(true)
    setMessage('')
    try {
      await action()
    } catch {
      setMessage(t('failed'))
    } finally {
      setBusy(false)
    }
  }
  async function read() {
    const body = new FormData()
    body.append('file', file)
    const response = await fetch(API + '/preview', { method: 'POST', body })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error()
    setPreview(result.data)
    setPages({})
    setActiveGroup('drivers')
    setConfirmed(false)
    setCompleted(false)
  }
  function change(group, key, update) {
    setConfirmed(false)
    setPreview((previous) => ({
      ...previous,
      rows: {
        ...previous.rows,
        [group]: previous.rows[group].map((row) => (row.key === key ? update(row) : row)).filter(Boolean),
      },
    }))
  }
  const unresolved = preview
    ? groups.some((group) =>
        preview.rows[group].some(
          (row) =>
            !row.targetId &&
            preview.fields[group].some(
              (field) =>
                field.type === 'reference' &&
                !preview.rows[field.group].some((item) => item.key === row.data[field.name])
            )
        )
      )
    : false
  async function commit() {
    const rows = Object.fromEntries(
      groups.map((group) => [
        group,
        preview.rows[group].map(({ key, data, targetId, includeImage }) => ({ key, data, targetId, includeImage })),
      ])
    )
    const response = await fetch(API + '/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: preview.id, rows, confirmed }),
    })
    const result = await response.json()
    if (response.status === 409) {
      setConfirmed(false)
      setMessage(t('stale'))
      return
    }
    if (!response.ok || !result.success) throw new Error()
    setCompleted(true)
    setPreview(null)
    setMessage(t('done', { backup: result.data.backupFile }))
  }
  return (
    <div className="p-6 space-y-4" data-testid="cockpit-import-page">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('upload')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>{t('help')}</p>
          <p className="text-sm text-muted-foreground">{t('scope')}</p>
          <Input
            aria-label={t('upload')}
            data-testid="cockpit-file"
            type="file"
            accept=".zip,application/zip"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] || null)
              setPreview(null)
              setConfirmed(false)
              setMessage('')
              setCompleted(false)
            }}
          />
          <Button
            data-testid="cockpit-preview"
            disabled={!file || busy || file.size > 180 * 1024 * 1024}
            onClick={() => run(read)}
          >
            {t('preview')}
          </Button>
        </CardContent>
      </Card>
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>{t('review')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{t('reviewHelp')}</p>
            <p className="text-sm text-muted-foreground">{t('linksHelp')}</p>
            <Tabs value={activeGroup} onValueChange={setActiveGroup}>
              <TabsList className="flex flex-wrap h-auto">
                {groups.map((group) => (
                  <TabsTrigger data-testid={`cockpit-tab-${group}`} key={group} value={group}>
                    {t(`groups.${group}`)} ({preview.rows[group].length})
                  </TabsTrigger>
                ))}
              </TabsList>
              {groups
                .filter((group) => group === activeGroup)
                .map((group) => (
                  <TabsContent key={group} value={group}>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('action')}</TableHead>
                            {preview.fields[group].map((field) => (
                              <TableHead key={field.name}>{t(`fields.${field.name}`)}</TableHead>
                            ))}
                            {['drivers', 'cars', 'tracks'].includes(group) && <TableHead>{t('image')}</TableHead>}
                            <TableHead>{t('remove')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.rows[group]
                            .slice((pages[group] || 0) * pageSize, ((pages[group] || 0) + 1) * pageSize)
                            .map((row) => (
                              <TableRow key={row.key} data-testid={`cockpit-row-${group}`}>
                                <TableCell>
                                  <Select
                                    disabled={busy || row.lockedTarget}
                                    value={row.targetId || '__new'}
                                    onValueChange={(value) =>
                                      change(group, row.key, (item) => ({
                                        ...item,
                                        targetId: value === '__new' ? '' : value,
                                      }))
                                    }
                                  >
                                    <SelectTrigger aria-label={t('action')} className="min-w-44">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__new">{t('create')}</SelectItem>
                                      {preview.targets[group].map((target) => (
                                        <SelectItem key={target.id} value={target.id}>
                                          {t('link', { name: target.label })}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                {preview.fields[group].map((field) => (
                                  <TableCell key={field.name}>
                                    <Field
                                      field={field}
                                      value={row.data[field.name]}
                                      rows={preview.rows}
                                      busy={busy || !!row.targetId}
                                      t={t}
                                      onChange={(value) =>
                                        change(group, row.key, (item) => ({
                                          ...item,
                                          includeImage: field.name === 'img' ? false : item.includeImage,
                                          data: { ...item.data, [field.name]: value },
                                        }))
                                      }
                                    />
                                  </TableCell>
                                ))}
                                {['drivers', 'cars', 'tracks'].includes(group) && (
                                  <TableCell>
                                    {row.hasImage && (
                                      <label className="flex items-center gap-2">
                                        <img
                                          className="max-w-20 max-h-20 object-contain"
                                          src={`${API}/preview/${preview.id}/image/${row.key}`}
                                          alt=""
                                        />
                                        <Checkbox
                                          aria-label={t('image')}
                                          disabled={busy || !!row.targetId}
                                          checked={row.includeImage}
                                          onCheckedChange={(value) =>
                                            change(group, row.key, (item) => ({ ...item, includeImage: value }))
                                          }
                                        />
                                      </label>
                                    )}
                                  </TableCell>
                                )}
                                <TableCell>
                                  <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => change(group, row.key, () => null)}
                                  >
                                    {t('remove')}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex gap-3 items-center py-3">
                      <Button
                        variant="outline"
                        disabled={busy || !(pages[group] > 0)}
                        onClick={() => setPages((previous) => ({ ...previous, [group]: (previous[group] || 0) - 1 }))}
                      >
                        {t('previous')}
                      </Button>
                      <span>
                        {t('page', {
                          page: (pages[group] || 0) + 1,
                          count: Math.max(1, Math.ceil(preview.rows[group].length / pageSize)),
                        })}
                      </span>
                      <Button
                        variant="outline"
                        disabled={busy || ((pages[group] || 0) + 1) * pageSize >= preview.rows[group].length}
                        onClick={() => setPages((previous) => ({ ...previous, [group]: (previous[group] || 0) + 1 }))}
                      >
                        {t('next')}
                      </Button>
                    </div>
                    {!preview.rows[group].length && <p>{t('empty')}</p>}
                  </TabsContent>
                ))}
            </Tabs>
            {unresolved && <p role="alert">{t('unresolvedHelp')}</p>}
            <label className="flex items-center gap-2">
              <Checkbox
                data-testid="cockpit-confirm"
                checked={confirmed}
                disabled={busy || unresolved}
                onCheckedChange={setConfirmed}
              />
              {t('confirm')}
            </label>
            <Button
              data-testid="cockpit-import"
              disabled={busy || !confirmed || unresolved}
              onClick={() => run(commit)}
            >
              {t('import')}
            </Button>
          </CardContent>
        </Card>
      )}
      {busy && <p role="status">{t('busy')}</p>}
      {message && <p role={completed ? 'status' : 'alert'}>{message}</p>}
    </div>
  )
}
