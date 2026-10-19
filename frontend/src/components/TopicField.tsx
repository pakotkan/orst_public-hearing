import { AGREE_LABEL, MAX_AGENCY_LENGTH, MAX_COMMENT_LENGTH, type SummaryTopic, type TopicAnswer } from '../lib/api'
import { MINISTRY_NAMES } from '../lib/ministries'

/** Value of the agency dropdown's "other" option; the typed name is kept in `agencyOther`. */
const OTHER_AGENCY = '__other__'

/**
 * A topic's answer while the form is being filled in. `agreement` is null until the user picks.
 * `agencyChoice` is '' (none), a ministry name, or OTHER_AGENCY.
 */
export type TopicDraft = {
  summaryTopicId: string
  agreement: boolean | null
  additionalComment: string
  agencyChoice: string
  agencyOther: string
}

export const emptyTopicDraft = (summaryTopicId: string): TopicDraft => ({
  summaryTopicId,
  agreement: null,
  additionalComment: '',
  agencyChoice: '',
  agencyOther: '',
})

/** Turns a saved answer back into form state. Agencies not in the ministry list go into "other". */
export function toTopicDraft(answer: TopicAnswer): TopicDraft {
  const agency = answer.relatedAgency ?? ''
  const isMinistry = MINISTRY_NAMES.includes(agency)
  return {
    summaryTopicId: answer.summaryTopicId,
    agreement: answer.agreement,
    additionalComment: answer.additionalComment ?? '',
    agencyChoice: !agency ? '' : isMinistry ? agency : OTHER_AGENCY,
    agencyOther: agency && !isMinistry ? agency : '',
  }
}

/** The agency to send: a ministry name, the typed "other" name, or undefined. */
export function draftAgency(draft: TopicDraft) {
  const agency = draft.agencyChoice === OTHER_AGENCY ? draft.agencyOther.trim() : draft.agencyChoice
  return agency || undefined
}

/**
 * One topic on the public response form, answered in steps:
 *   1. Yes / No.  A "no" can only be submitted as is.
 *   2. With a "yes": an optional comment.
 *   3. With a "yes": an optional related agency, picked from the ministries or typed in under "other".
 * Switching to "no" clears steps 2 and 3.
 */
export function TopicField({
  topic,
  number,
  draft,
  disabled,
  onChange,
}: {
  topic: SummaryTopic
  number: number
  draft: TopicDraft
  disabled?: boolean
  onChange: (draft: TopicDraft) => void
}) {
  const name = `topic-${topic.id}`
  const agency = draftAgency(draft)

  return (
    <fieldset className="topic-field" disabled={disabled}>
      <legend>
        <span className="topic-number">{number}.</span> {topic.title}
      </legend>

      <div className="topic-step">
        <span className="step-badge">1</span>
        <div className="yes-no">
          <label className={`yes-no-option yes ${draft.agreement === true ? 'selected' : ''}`}>
            <input type="radio" name={name} checked={draft.agreement === true} onChange={() => onChange({ ...draft, agreement: true })} />
            ✓ {AGREE_LABEL.yes}
          </label>
          <label className={`yes-no-option no ${draft.agreement === false ? 'selected' : ''}`}>
            <input
              type="radio"
              name={name}
              checked={draft.agreement === false}
              onChange={() => onChange({ ...emptyTopicDraft(topic.id), agreement: false })}
            />
            ✕ {AGREE_LABEL.no}
          </label>
        </div>
      </div>

      {draft.agreement === true && (!disabled || draft.additionalComment) && (
        <div className="topic-step">
          <span className="step-badge">2</span>
          <label className="topic-detail">
            <span className="small">
              ความเห็นเพิ่มเติม <span className="muted">(ไม่บังคับ)</span>
            </span>
            <textarea
              value={draft.additionalComment}
              onChange={(e) => onChange({ ...draft, additionalComment: e.target.value })}
              rows={4}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="อธิบายความเห็นของคุณ…"
            />
            {!disabled && (
              <small className="muted">
                {draft.additionalComment.length.toLocaleString('th-TH')}/{MAX_COMMENT_LENGTH.toLocaleString('th-TH')} ตัวอักษร
              </small>
            )}
          </label>
        </div>
      )}

      {draft.agreement === true && (!disabled || agency) && (
        <div className="topic-step">
          <span className="step-badge">3</span>
          <div className="topic-detail">
            <label className="topic-detail">
              <span className="small">
                หน่วยงานที่คิดว่าเกี่ยวข้อง <span className="muted">(ไม่บังคับ)</span>
              </span>
              <select value={draft.agencyChoice} onChange={(e) => onChange({ ...draft, agencyChoice: e.target.value })}>
                <option value="">— ไม่ระบุ —</option>
                {MINISTRY_NAMES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value={OTHER_AGENCY}>อื่น ๆ (โปรดระบุ)</option>
              </select>
            </label>
            {draft.agencyChoice === OTHER_AGENCY && (
              <input
                value={draft.agencyOther}
                onChange={(e) => onChange({ ...draft, agencyOther: e.target.value })}
                maxLength={MAX_AGENCY_LENGTH}
                placeholder="ระบุชื่อหน่วยงาน"
                aria-label="ระบุชื่อหน่วยงานอื่น"
              />
            )}
          </div>
        </div>
      )}
    </fieldset>
  )
}
