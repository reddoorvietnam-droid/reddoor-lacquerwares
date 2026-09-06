import { describe, expect, it } from "vitest";

import {
  ConversationError,
  type ConversationDto,
} from "@/domains/assistant/conversations/contracts";
import {
  ConversationService,
  type RecordTurnInput,
} from "@/domains/assistant/conversations/service";

import { FakeAttachmentStore } from "./helpers/assistant-attachment-fakes";
import { FakeConversationStore } from "./helpers/assistant-conversation-fakes";

/**
 * What these tests hold the service to: a transcript belongs to one person,
 * it lives seven days from its last turn, and the files a turn carried are
 * bound to it and stripped of their image bytes. Ownership is never asserted
 * through a permission fake, because the service has no permission input —
 * the store's owner filter is the whole mechanism.
 */

const owner = "a1a1a1a1a1a1a1a1a1a1a1a1";
const stranger = "b2b2b2b2b2b2b2b2b2b2b2b2";

const now = new Date("2026-09-06T02:00:00.000Z");
const inSevenDays = new Date("2026-09-13T02:00:00.000Z");
/** A second turn on the last day of the window, and the expiry it moves to. */
const aWeekLater = new Date("2026-09-12T09:00:00.000Z");
const sevenDaysAfterThat = new Date("2026-09-19T09:00:00.000Z");

function build() {
  const store = new FakeConversationStore();
  const attachments = new FakeAttachmentStore();
  const service = new ConversationService({ store, attachments });
  return { store, attachments, service };
}

function turn(overrides: Partial<RecordTurnInput> = {}): RecordTurnInput {
  return {
    ownerUserId: owner,
    conversationId: null,
    now,
    userText: "Đơn ORD-1 còn thiếu việc gì?",
    attachmentIds: [],
    assistantText: "Còn hai việc chưa xong.",
    trace: [],
    sources: [],
    proposalIds: [],
    truncated: false,
    ...overrides,
  };
}

/** Someone else's transcript, put there the only way the store allows. */
function seedStrangerConversation(
  store: FakeConversationStore,
): Promise<ConversationDto> {
  return store.create({
    ownerUserId: stranger,
    title: "Bảng lương tháng 8",
    lastMessageAt: now,
    expiresAt: inSevenDays,
  });
}

/**
 * The one place these tests look past the store interface: a message's
 * expiry is stamped by the store and is not part of `ConversationMessageDto`,
 * so the fake's own records are the only witness that `touch` slid it.
 */
function messageExpiries(
  store: FakeConversationStore,
  conversationId: string,
): Date[] {
  return (store.messages.get(conversationId) ?? []).map(
    (entry) => entry.expiresAt,
  );
}

describe("ConversationService.recordTurn", () => {
  it("creates the conversation on the first turn and titles it from the question", async () => {
    const { service } = build();

    const result = await service.recordTurn(
      turn({ userText: "  Đơn ORD-1   còn thiếu việc gì?  " }),
    );

    expect(result.conversation.ownerUserId).toBe(owner);
    expect(result.conversation.title).toBe("Đơn ORD-1 còn thiếu việc gì?");
    expect(result.conversation.messageCount).toBe(2);
    expect(result.conversation.expiresAt).toEqual(inSevenDays);
    expect(result.userMessage.index).toBe(0);
    expect(result.userMessage.role).toBe("user");
    expect(result.assistantMessage.index).toBe(1);
    expect(result.assistantMessage.role).toBe("assistant");
    expect(await service.list(owner, {})).toHaveLength(1);
  });

  it("appends the second turn to the same conversation instead of starting another", async () => {
    const { service } = build();
    const first = await service.recordTurn(turn());

    const second = await service.recordTurn(
      turn({
        conversationId: first.conversation.id,
        userText: "Ai đang làm việc còn lại?",
      }),
    );

    expect(second.conversation.id).toBe(first.conversation.id);
    expect(second.conversation.title).toBe(first.conversation.title);
    expect(second.conversation.messageCount).toBe(4);
    expect(second.userMessage.index).toBe(2);
    expect(second.assistantMessage.index).toBe(3);
    const read = await service.read(owner, first.conversation.id, 50);
    expect(read.messages.map((message) => message.index)).toEqual([0, 1, 2, 3]);
    expect(await service.list(owner, {})).toHaveLength(1);
  });

  it("reports NOT_FOUND for a conversation the owner does not have, rather than starting a new one", async () => {
    const { service, store } = build();
    const theirs = await seedStrangerConversation(store);

    await expect(
      service.recordTurn(turn({ conversationId: theirs.id })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await service.list(owner, {})).toEqual([]);
  });

  it("slides the expiry onto the header and every message when a later turn arrives", async () => {
    const { service, store } = build();
    const first = await service.recordTurn(turn());

    const second = await service.recordTurn(
      turn({ conversationId: first.conversation.id, now: aWeekLater }),
    );

    expect(second.conversation.expiresAt).toEqual(sevenDaysAfterThat);
    expect(second.conversation.lastMessageAt).toEqual(aWeekLater);
    const header = await store.findForOwner(owner, first.conversation.id);
    expect(header?.expiresAt).toEqual(sevenDaysAfterThat);
    expect(messageExpiries(store, first.conversation.id)).toEqual([
      sevenDaysAfterThat,
      sevenDaysAfterThat,
      sevenDaysAfterThat,
      sevenDaysAfterThat,
    ]);
  });

  it("binds the attachments a turn names to the conversation and clears their image payload", async () => {
    const { service, attachments } = build();
    const file = attachments.seed({
      ownerUserId: owner,
      fileName: "hoa-don.png",
      format: "png",
      kind: "image",
      text: null,
      image: { mediaType: "image/png", base64: "aGk=" },
      // Uploaded before the turn, so its window is the one the turn replaces.
      expiresAt: new Date("2026-09-09T02:00:00.000Z"),
    });

    const result = await service.recordTurn(
      turn({ userText: "Đọc giúp hoá đơn này", attachmentIds: [file.id] }),
    );

    expect(
      result.userMessage.attachments.map((attachment) => attachment.fileName),
    ).toEqual(["hoa-don.png"]);
    expect(result.assistantMessage.attachments).toEqual([]);
    const [stored] = await attachments.findManyForOwner(owner, [file.id]);
    expect(stored?.conversationId).toBe(result.conversation.id);
    expect(stored?.image).toBeNull();
    expect(stored?.expiresAt).toEqual(inSevenDays);
  });
});

describe("ConversationService.read", () => {
  it("reports NOT_FOUND for another owner's conversation, not a permission error and not an empty transcript", async () => {
    const { service, store } = build();
    const theirs = await seedStrangerConversation(store);

    await expect(service.read(owner, theirs.id, 50)).rejects.toBeInstanceOf(
      ConversationError,
    );
    await expect(service.read(owner, theirs.id, 50)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await service.list(owner, {})).toEqual([]);
  });
});

describe("ConversationService.resolveAttachments", () => {
  it("reports NOT_FOUND for an attachment belonging to someone else, and writes no turn", async () => {
    const { service, attachments } = build();
    const theirs = attachments.seed({ ownerUserId: stranger });

    await expect(
      service.resolveAttachments(owner, [theirs.id]),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.recordTurn(turn({ attachmentIds: [theirs.id] })),
    ).rejects.toBeInstanceOf(ConversationError);
    expect(await service.list(owner, {})).toEqual([]);
  });
});

describe("ConversationService.remove", () => {
  it("deletes the conversation with its messages and the attachments recorded against it", async () => {
    const { service, store, attachments } = build();
    const file = attachments.seed({ ownerUserId: owner });
    const created = await service.recordTurn(
      turn({ attachmentIds: [file.id] }),
    );

    await service.remove(owner, created.conversation.id);

    expect(await service.list(owner, {})).toEqual([]);
    expect(
      await store.listMessages(owner, created.conversation.id, 50),
    ).toEqual([]);
    expect(await attachments.findManyForOwner(owner, [file.id])).toEqual([]);
    await expect(
      service.read(owner, created.conversation.id, 50),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

/**
 * The clamps and the sliding window, which the schemas rely on but the fake
 * store cannot enforce: a value too long for MongoDB fails the write, and a
 * failed write discards an answer the person has already been shown.
 */
describe("ConversationService: what it clamps and what it slides", () => {
  it("gives a files-only turn something to show instead of an empty line", async () => {
    const { attachments, service } = build();
    const file = attachments.seed({
      ownerUserId: owner,
      fileName: "bang-luong.xlsx",
      format: "xlsx",
      kind: "spreadsheet",
    });

    const result = await service.recordTurn(
      turn({ userText: "", attachmentIds: [file.id] }),
    );

    // Empty text fails the schema's `required` and would take the whole
    // turn down; the replay also skips a turn with nothing to say.
    expect(result.userMessage.text).toBe("(tệp đính kèm: bang-luong.xlsx)");
    expect(result.conversation.title).toBe("bang-luong.xlsx");
  });

  it("cuts an over-long answer and marks the turn truncated rather than losing it", async () => {
    const { service } = build();
    const long = "a".repeat(9_000);

    const result = await service.recordTurn(turn({ assistantText: long }));

    expect(result.assistantMessage.text.length).toBe(8_000);
    expect(result.assistantMessage.text.endsWith("…")).toBe(true);
    expect(result.assistantMessage.truncated).toBe(true);
  });

  it("moves a file attached on an earlier turn to the transcript's new expiry", async () => {
    const { attachments, service } = build();
    const file = attachments.seed({ ownerUserId: owner });
    const first = await service.recordTurn(turn({ attachmentIds: [file.id] }));

    await service.recordTurn(
      turn({
        conversationId: first.conversation.id,
        now: aWeekLater,
        attachmentIds: [],
      }),
    );

    // Without the slide the file would be deleted on day 7 while the
    // conversation it belongs to lived to day 13.
    const stored = attachments.records.get(file.id);
    expect(stored?.expiresAt).toEqual(sevenDaysAfterThat);
  });

  it("leaves nothing behind when the first turn cannot be written", async () => {
    const { store, service } = build();
    store.appendMessages = async () => {
      throw new Error("write failed");
    };

    await expect(service.recordTurn(turn())).rejects.toThrow("write failed");

    // A header with no messages would sit in the owner's list for seven
    // days, titled after a question whose answer is nowhere.
    expect(await service.list(owner, {})).toEqual([]);
  });

  it("reports NOT_FOUND for a stranger's conversation without deleting anything", async () => {
    const { store, attachments, service } = build();
    const theirs = await seedStrangerConversation(store);
    const theirFile = attachments.seed({
      ownerUserId: stranger,
      conversationId: theirs.id,
    });

    await expect(service.remove(owner, theirs.id)).rejects.toBeInstanceOf(
      ConversationError,
    );
    expect(attachments.records.get(theirFile.id)).toBeDefined();
    expect(await store.findForOwner(stranger, theirs.id)).not.toBeNull();
  });
});
