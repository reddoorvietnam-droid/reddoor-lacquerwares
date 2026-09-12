# Giao việc — assigning work and receiving it

Built 2026-09-12. One desk hands work out, everyone else has an inbox of what
they were given. It replaces the single shared "Việc cần làm" screen, which
mixed both jobs and showed each role more than it acted on.

Routes: `/{locale}/admin/tasks` (Giao việc, Director) ·
`/{locale}/admin/my-tasks` (Công việc được giao, every role) ·
Domain: [`src/domains/tasks`](../src/domains/tasks) ·
Notifications: [`src/domains/notifications`](../src/domains/notifications) ·
E2E: [`tests/e2e-admin/assign-work.spec.ts`](../tests/e2e-admin/assign-work.spec.ts)

---

## 1. What each side sees

**Giao việc** (needs `tasks.assign`, held by the Director alone):

- a form that hands work to any active staff account: việc, ghi chú, hạn
  (ngày), ưu tiên, mã đơn (tùy chọn);
- the board of every task, filtered by status, overdue first, each card
  editable in place (wording, deadline, priority, assignee);
- **Xin gia hạn chờ duyệt** — the queue of deadline requests, each with the
  current deadline, the day asked for and the reason, answered with
  **Duyệt gia hạn** or **Từ chối** plus an optional note;
- the assistant's pending proposals, the reminder outbox and the manual
  "Chạy nhắc việc ngay" button, all as before.

**Công việc được giao** (needs `tasks.read`, held by every role at `own`):

- only the tasks assigned to the reader, never a colleague's;
- **Xong**, and **Xin gia hạn** (a new day plus a required reason);
- while a request waits, the card says so and no second request is accepted;
- once answered, the card shows the answer and any note;
- the reader's own Zalo link, so reminders reach their phone.

## 2. The deadline rule

The deadline belongs to whoever handed the work out. The assignee may ask to
move it and must say why; the date does not change until the Director
approves. Approving sets `dueAt` to the day that was asked for, so the
reminder schedule follows it without another step; declining leaves the
deadline and the reminders exactly as they were. Either answer is stored on
the task (`lastExtensionDecision`) and audited
(`task.extensionRequested` / `task.extensionApproved` / `task.extensionRejected`).

A request is refused when the asker is not the assignee (`NOT_ASSIGNEE`), the
task is closed, one is already waiting (`EXTENSION_PENDING`), or the day is in
the past or the one already set (`INVALID_DUE_DATE`). Setting the deadline by
hand, finishing the task or cancelling it clears a pending request: the
question it asked no longer stands.

## 3. Permissions (changed 2026-09-12)

| Role                                                       | tasks.read | tasks.update | tasks.create / assign / approvePlan |
| ---------------------------------------------------------- | ---------- | ------------ | ----------------------------------- |
| Giám đốc                                                   | all        | all          | all                                 |
| Thủ kho, Quản lý nhà máy, Kế toán nhà máy, Kế toán công ty | own        | own          | —                                   |
| Biên tập nội dung                                          | own        | own          | —                                   |

Consequences, agreed with the client before the change:

- the Factory Manager and the Company Accountant no longer approve an
  assistant-drafted plan, and no role but the Director can ask the assistant
  to draft one (`propose_order_plan`, `propose_tasks`,
  `propose_sheet_check_follow_ups` all need `tasks.create`);
- the Content Creator, who held no task permission at all, now receives
  assigned work like everyone else;
- `list_my_tasks` still answers "what do I have to do today" for every role:
  an `own` grant offers the tool, and the read narrows to that person.

Two mechanics make an `own` grant workable for a list screen:

1. `requireListAccess` presents the units the `own` grant is bound to as the
   target (a list names no record), so a unit-bound grant opens its holder's
   own list; the sidebar entry uses the same guard through
   `canSeeAssignedTasks`, so the menu shows exactly what opens.
2. Work handed to someone else **without an order** is stamped with that
   person's business units (`TaskCommandService.create` / `update` via
   `UserBusinessUnits`). A unit-bound `own` grant reaches a record only
   inside its units, so without this the assignee could not touch the task
   they were given. Work from an order keeps the order's units, as before.

## 4. Messages

Three events are queued the moment the action succeeds and drained straight
away, instead of waiting for the nightly reminder run:

| Kind                     | Goes to                  | Raised by                                         |
| ------------------------ | ------------------------ | ------------------------------------------------- |
| `taskAssigned`           | the assignee             | work handed over, or its deadline/assignee edited |
| `taskExtensionRequested` | whoever created the task | the assignee asks for more time                   |
| `taskExtensionDecided`   | the asker                | the Director answers                              |

They are ordinary outbox rows: same delivery policy
(`NOTIFICATION_DELIVERY=off|test|live`), same dedupe discipline (the task's
revision is the event key, so a repeated submit sends nothing), same quiet
hours (`REMINDER_QUIET_HOURS`, default `21-7`, pushes a night-time message to
the morning), and the same evidence table on the Director's screen. Sending
runs after the response (`after()`), so a slow provider never delays the page
and a failed send leaves the row queued for the next run.

The daily reminders (`taskDueSoon`, `taskDue`, `taskOverdue`) are unchanged.

## 5. Verification

| Check                      | Command                                                                                                               | Result                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Unit                       | `npx vitest run`                                                                                                      | PASS — 1589 tests, incl. `tests/unit/tasks-extension.test.ts` |
| Typecheck / lint / build   | `npm run typecheck`, `npm run lint`, `npm run build`                                                                  | PASS                                                          |
| Role seeds in the database | `npm run seed`                                                                                                        | 6 role definitions provisioned 2026-09-12                     |
| E2E (real app, dev server) | `E2E_ADMIN_BASE_URL=http://localhost:3000 npx playwright test -c playwright.admin.config.ts assign-work director-nav` | PASS — 6/6                                                    |

The E2E run covers the whole round trip: the Director assigns with a deadline,
the storekeeper reads it, asks for more time, the Director approves, the
deadline moves, the storekeeper marks it done — and the outbox shows the
`taskAssigned` row the assignment raised.

## 6. Not built (deliberately)

Recurring tasks, one task for several people, attachments, an in-task
comment thread, and a month-calendar view. A "đã nhận việc" acknowledgement
was considered and rejected: the client wants one button, not two.
