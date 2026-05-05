# Workflow Schema

Defines how business process workflows are structured. The schema separates what the workflow author defines from what the engine handles automatically.

---

## Top-level Structure

```json
{
  "inputs": ["field1", "field2"],
  "triggerTable": "테이블이름",
  "notify": ["role1", "role2"],
  "stages": [...]
}
```

| Field | Description |
|---|---|
| `inputs` | Input fields required to start the workflow |
| `triggerTable` | User-data table whose new rows trigger this workflow. `null` if not table-triggered. |
| `notify` | Roles subscribed to all activity updates for this run (status changes, approvals, task completions) |
| `stages` | Ordered list of stages — executed sequentially |

---

## Stages

Actions within a stage fire in parallel. The next stage only starts after all actions in the current stage are complete.

```json
"stages": [
  { "actions": [...] },
  { "actions": [...] }
]
```

---

## Action Types

### create_task

```json
{
  "type": "create_task",
  "title": "운행기록 대조, 실사용자 확인",
  "role": "경영지원팀 사원",
  "dueDays": 1
}
```

| Field | Description |
|---|---|
| `title` | Task title |
| `role` | Role assigned to the task |
| `dueDays` | Due in N days from now |
| `deadline` | Deadline from an input field — `{ "ref": "납부기한" }` |

`dueDays` and `deadline` are mutually exclusive. Use `dueDays` for relative urgency, `deadline` when the input carries the actual due date.

### approve

```json
{
  "type": "approve",
  "title": "과태료 납부 승인",
  "approvalChain": [
    { "role": "경영지원팀 과장" },
    { "role": "이사" },
    { "role": "대표이사" }
  ]
}
```

Pauses the workflow run and routes through the approval chain sequentially from bottom to top.

| Field | Description |
|---|---|
| `title` | Label shown to approvers |
| `approvalChain` | Ordered list of approvers, bottom to top |

### update_status

```json
{ "type": "update_status", "value": "정상진행중" }
```

Valid values: `정상진행중` · `반려중` · `정상완료` · `취소완료`

---

## Run Reference

Each run records which data row triggered it so the history view can link back to the source.

```json
{
  "workflowId": "...",
  "inputData": { "차량번호": "12가3456", "과태료_금액": 80000 },
  "sourceTable": "법인차량 과태료",
  "sourceRowId": "row-uuid"
}
```

| Field | Description |
|---|---|
| `inputData` | Input field values supplied when the run was started |
| `sourceTable` | User-data table the run was triggered from. `null` if started manually. |
| `sourceRowId` | Row ID in `sourceTable` that triggered this run. `null` if started manually. |

---

## System-handled Behavior

These are engine responsibilities — not defined in the workflow:

**Status transitions**
- Run starts → `정상진행중`
- Approval chain completes → `정상완료`
- Bottom approver cancels → `취소완료`
- Bottom approver rejects (cascade reaches floor) → `반려중`

**Approval chain rejection**
- Any approver rejects → steps back one level, re-notifies the person below
- Bottom of chain has no 반려 option — only 취소 or 수정 후 재상신

**Cancellation**
- Cancelling at any point → `취소완료`, all active participants notified automatically

**Notify subscriptions**
- All roles listed in `notify` receive updates on every status change, task completion, and approval event for the run

---

## Example — 법인차량 과태료 고지 및 납부 승인

```json
{
  "inputs": ["차량번호", "위반내용", "과태료_금액", "납부기한"],
  "triggerTable": "법인차량 과태료",
  "notify": ["경영지원팀 사원", "이사"],
  "stages": [
    {
      "actions": [
        { "type": "create_task", "title": "운행기록 대조, 실사용자 확인", "role": "경영지원팀 사원", "dueDays": 1 },
        { "type": "create_task", "title": "과태료 납부 처리", "role": "경영지원팀 사원", "deadline": { "ref": "납부기한" } }
      ]
    },
    {
      "actions": [
        {
          "type": "approve",
          "title": "과태료 납부 승인",
          "approvalChain": [
            { "role": "경영지원팀 과장" },
            { "role": "이사" },
            { "role": "대표이사" }
          ]
        }
      ]
    }
  ]
}
```
