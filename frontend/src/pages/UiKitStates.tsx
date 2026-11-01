import { useState } from 'react'
import { Button, Card, Form, FormItem, IconButton, Icons, Input, Select, Textarea } from '@/ui'
import { kitStrings as text } from './uiKit.strings'

export function UiKitStates() {
  const [loading, setLoading] = useState(false)
  const [value, setValue] = useState('')
  return (
    <div className="kit-state-grid">
      <Card title={text.sizes} subtitle={text.sizesHelp}>
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <div key={size} className="kit-control-row">
            <Input
              size={size}
              aria-label={text.fieldSize(size)}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={size}
            />
            <Select
              size={size}
              aria-label={text.selectSize(size)}
              value={size}
              options={[{ label: size, value: size }]}
            />
            <Button size={size} icon={<Icons.IconPlus />}>
              {size}
            </Button>
          </div>
        ))}
      </Card>
      <Card title={text.states}>
        <Form>
          <FormItem label={text.disabled}>
            <Input disabled value={text.longText} />
          </FormItem>
          <FormItem label={text.error} error={text.invalid}>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          </FormItem>
          <FormItem label={text.editable} help={text.help}>
            <Textarea rows={2} value={value} onChange={(e) => setValue(e.target.value)} />
          </FormItem>
          <div className="kit-state-actions">
            <Button variant="primary" loading={loading}>
              {text.save}
            </Button>
            <Button onClick={() => setLoading((v) => !v)}>{text.toggleLoading}</Button>
            <IconButton disabled aria-label={text.disabled}>
              <Icons.IconReload />
            </IconButton>
          </div>
        </Form>
      </Card>
    </div>
  )
}
