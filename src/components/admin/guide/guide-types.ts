import type { SystemRoleKey } from "@/domains/identity/role-definitions";

/**
 * Shapes of the "Hướng dẫn sử dụng website" page. The guide is fixed copy,
 * written for staff who are not technical: each role reads only its own part,
 * and every screen section matches an entry of that role's menu.
 *
 * Text may wrap an on-screen label in **double asterisks**; the page renders
 * it bold so the reader can spot the button or column it names.
 */
export type GuideText = string;

/**
 * Narrows an entry to some of the roles that open the screen. Omitted, the
 * entry applies to every role whose menu holds the screen.
 */
type ForRoles = { roles?: readonly SystemRoleKey[] };

export type GuidePoint = ForRoles & { text: GuideText };

/** One job done start to finish, in numbered steps. */
export type GuideFlow = ForRoles & {
  title: GuideText;
  /** When someone does this job. */
  when?: GuideText;
  steps: readonly GuideText[];
  /** What has changed once the steps are done, and who acts next. */
  result?: GuideText;
  /**
   * Screens this job passes through, as paths below `/[locale]/admin`
   * (e.g. "/orders"). Only used by role-level workflows.
   */
  links?: readonly string[];
};

/** A status, badge, column or abbreviation the reader meets on the screen. */
export type GuideTerm = ForRoles & { term: GuideText; meaning: GuideText };

/** Everything the guide says about one menu entry. */
export type ScreenGuide = {
  /**
   * The entry's path below `/[locale]/admin`, exactly as the menu links it:
   * "" for the overview, "/finance/invoices" for the invoices screen.
   */
  path: string;
  /** The menu label, word for word. */
  title: string;
  /** What the screen is for, in one or two sentences. */
  summary: GuideText;
  /** What the reader sees on the screen, area by area. */
  layout: readonly GuidePoint[];
  /** Things the reader can do here. */
  capabilities: readonly GuidePoint[];
  /** Things the reader cannot do here, and who does them instead. */
  limits: readonly GuidePoint[];
  flows: readonly GuideFlow[];
  terms: readonly GuideTerm[];
  /** Advice, common mistakes and what the messages on screen mean. */
  tips: readonly GuidePoint[];
};

export type GuideQuestion = { question: GuideText; answer: GuideText };

/** The part of the guide that describes the position itself. */
export type RoleGuide = {
  key: SystemRoleKey;
  /** Who this position is and what it is responsible for, in paragraphs. */
  intro: readonly GuideText[];
  /** The main pieces of work, one line each. */
  responsibilities: readonly GuideText[];
  /** Data this role can see. */
  sees: readonly GuideText[];
  /** Data kept from this role, with the reason and who holds it. */
  hidden: readonly GuideText[];
  /** Jobs that run across several screens, described end to end. */
  workflows: readonly GuideFlow[];
  faq: readonly GuideQuestion[];
};

/** Using the portal in general: signing in, the menu, messages, signing out. */
export type GuideBasic = { title: GuideText; points: readonly GuidePoint[] };
