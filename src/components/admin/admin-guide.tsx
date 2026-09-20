import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Lightbulb,
  Minus,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { roleIcons } from "@/components/admin/admin-welcome";
import { GuideHashOpener } from "@/components/admin/guide-hash-opener";
import { screenAnchor, type RoleGuideView } from "@/components/admin/guide";
import type {
  GuideFlow,
  GuidePoint,
  GuideTerm,
  ScreenGuide,
} from "@/components/admin/guide/guide-types";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import type { AdminLocale } from "@/lib/i18n/admin";

/**
 * "Hướng dẫn sử dụng website": the reader's own role explained, then every
 * entry of their menu, folded one screen at a time. The copy is fixed and
 * Vietnamese; only the page's own headings follow the admin locale.
 */

const pageCopy = {
  vi: {
    eyebrow: "Hướng dẫn sử dụng",
    title: "Hướng dẫn sử dụng website",
    lead: "Tài liệu viết riêng cho vị trí của bạn: bạn phụ trách việc gì, được xem dữ liệu gì, và cách dùng từng mục trong menu — từng bước một.",
    contents: "Mục lục",
    role: "Vai trò của bạn",
    responsibilities: "Việc chính của bạn",
    data: "Dữ liệu bạn được xem",
    dataLead:
      "Mỗi vị trí chỉ thấy đúng phần dữ liệu cần cho công việc của mình. Nếu cần xem thêm, hãy hỏi Giám đốc.",
    sees: "Bạn được xem",
    hidden: "Không hiển thị với bạn",
    basics: "Làm quen với website",
    basicsLead: "Những điều dùng chung cho mọi màn hình.",
    workflows: "Các luồng công việc chính",
    workflowsLead:
      "Những công việc đi qua nhiều mục trong menu, mô tả từ đầu đến cuối. Bấm tên mục để mở đúng màn hình.",
    screens: "Hướng dẫn từng mục trong menu",
    screensLead:
      "Mỗi mục bên dưới ứng với một dòng trong menu của bạn, theo đúng thứ tự. Bấm vào tên mục để mở hướng dẫn chi tiết.",
    layout: "Trên màn hình có gì",
    capabilities: "Bạn làm được gì",
    limits: "Không làm được ở đây",
    flows: "Làm từng bước",
    when: "Khi nào",
    result: "Kết quả",
    related: "Mục liên quan",
    terms: "Giải thích từ ngữ trên màn hình",
    tips: "Mẹo và lưu ý",
    open: "Mở màn hình",
    faq: "Câu hỏi thường gặp",
    backToTop: "Về đầu trang",
    part: "Phần",
    counts: (can: number, flows: number) =>
      `${can} việc làm được · ${flows} hướng dẫn từng bước`,
  },
  en: {
    eyebrow: "User guide",
    title: "User guide",
    lead: "Written for your position, in Vietnamese: what you are responsible for, what data you see, and how to use each entry of your menu, step by step.",
    contents: "Contents",
    role: "Your role",
    responsibilities: "Your main work",
    data: "Data you can see",
    dataLead:
      "Each position sees only the data its work needs. Ask the Director if you need more.",
    sees: "You can see",
    hidden: "Not shown to you",
    basics: "Getting around",
    basicsLead: "What holds on every screen.",
    workflows: "Main workflows",
    workflowsLead:
      "Jobs that pass through several menu entries, start to finish. Pick an entry to open that screen.",
    screens: "Each menu entry",
    screensLead:
      "One section per entry of your menu, in menu order. Open a section for the detailed guide.",
    layout: "On the screen",
    capabilities: "What you can do",
    limits: "Not done here",
    flows: "Step by step",
    when: "When",
    result: "Result",
    related: "Related entries",
    terms: "Words on the screen",
    tips: "Tips",
    open: "Open screen",
    faq: "Frequently asked questions",
    backToTop: "Back to top",
    part: "Part",
    counts: (can: number, flows: number) =>
      `${can} things you can do · ${flows} step-by-step guides`,
  },
} as const;

type Copy = (typeof pageCopy)[AdminLocale];

const foldClass =
  "group border-burgundy/15 scroll-mt-28 rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
const cardClass =
  "border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
const subheadingClass =
  "text-charcoal/55 text-xs font-semibold tracking-[0.14em] uppercase";

/** Renders **label** as bold; everything else stays plain text. */
function Rich({
  text,
  strongClassName = "text-charcoal font-semibold",
}: {
  text: string;
  strongClassName?: string;
}) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className={strongClassName}>
        {part}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

function PartHeading({
  id,
  number,
  title,
  lead,
  text,
}: {
  id: string;
  number: number;
  title: string;
  lead?: string;
  text: Copy;
}) {
  return (
    <div id={id} className="scroll-mt-28">
      <p className="eyebrow">
        {text.part} {number}
      </p>
      <h2 className="text-burgundy mt-2 font-serif text-3xl tracking-[-0.02em] md:text-4xl">
        {title}
      </h2>
      {lead ? (
        <p className="text-charcoal/65 mt-3 max-w-3xl text-base leading-7">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

function PointList({
  points,
  icon,
}: {
  points: readonly (GuidePoint | string)[];
  icon: ReactNode;
}) {
  return (
    <ul className="grid gap-2.5">
      {points.map((point, index) => (
        <li
          key={index}
          className="text-charcoal/80 flex gap-3 text-[0.95rem] leading-7"
        >
          <span aria-hidden="true" className="mt-1.5 shrink-0">
            {icon}
          </span>
          <span className="min-w-0">
            <Rich text={typeof point === "string" ? point : point.text} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function FlowCard({
  flow,
  text,
  related,
}: {
  flow: GuideFlow;
  text: Copy;
  related?: readonly { href: Route; label: string }[];
}) {
  return (
    <article className="border-burgundy/12 bg-ivory/40 rounded-2xl border p-5 md:p-6">
      <h4 className="text-burgundy font-serif text-xl leading-snug">
        <Rich text={flow.title} strongClassName="font-semibold" />
      </h4>
      {flow.when ? (
        <p className="text-charcoal/65 mt-2 text-sm leading-6">
          <span className="text-charcoal/80 font-semibold">{text.when}: </span>
          <Rich text={flow.when} />
        </p>
      ) : null}
      <ol className="mt-4 grid gap-3">
        {flow.steps.map((step, index) => (
          <li key={index} className="flex gap-3">
            <span
              aria-hidden="true"
              className="bg-burgundy text-ivory grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold"
            >
              {index + 1}
            </span>
            <span className="text-charcoal/80 min-w-0 pt-0.5 text-[0.95rem] leading-7">
              <Rich text={step} />
            </span>
          </li>
        ))}
      </ol>
      {flow.result ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/80 mt-4 rounded-xl border px-4 py-3 text-sm leading-6">
          <span className="font-semibold">{text.result}: </span>
          <Rich text={flow.result} />
        </p>
      ) : null}
      {related && related.length > 0 ? (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-charcoal/55">{text.related}:</span>
          {related.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-burgundy border-burgundy/25 hover:bg-ivory inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 font-semibold"
            >
              {label}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          ))}
        </p>
      ) : null}
    </article>
  );
}

function TermList({ terms }: { terms: readonly GuideTerm[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {terms.map((term, index) => (
        <div
          key={index}
          className="border-burgundy/10 rounded-xl border bg-white px-4 py-3"
        >
          <dt className="text-burgundy text-sm font-semibold">
            <Rich text={term.term} strongClassName="font-semibold" />
          </dt>
          <dd className="text-charcoal/75 mt-1 text-sm leading-6">
            <Rich text={term.meaning} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ScreenSection({
  screen,
  index,
  href,
  text,
}: {
  screen: ScreenGuide;
  index: number;
  href: Route;
  text: Copy;
}) {
  return (
    <details id={screenAnchor(screen.path)} className={foldClass}>
      <summary className="flex cursor-pointer list-none items-start gap-4 p-5 md:p-6 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="border-burgundy/20 text-burgundy grid size-10 shrink-0 place-items-center rounded-full border font-serif text-lg"
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-burgundy block font-serif text-2xl leading-snug">
            {screen.title}
          </span>
          <span className="text-charcoal/70 mt-1 block text-sm leading-6">
            <Rich text={screen.summary} />
          </span>
          <span className="text-charcoal/45 mt-2 block text-xs font-semibold">
            {text.counts(screen.capabilities.length, screen.flows.length)}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="text-charcoal/40 mt-2 size-5 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="border-burgundy/10 grid gap-8 border-t px-5 pt-6 pb-8 md:px-8">
        {screen.layout.length > 0 ? (
          <section>
            <h3 className={subheadingClass}>{text.layout}</h3>
            <div className="mt-3">
              <PointList
                points={screen.layout}
                icon={<span className="bg-gold block size-1.5 rounded-full" />}
              />
            </div>
          </section>
        ) : null}

        {screen.capabilities.length > 0 || screen.limits.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {screen.capabilities.length > 0 ? (
              <section className="border-burgundy/10 rounded-2xl border p-5">
                <h3 className={subheadingClass}>{text.capabilities}</h3>
                <div className="mt-3">
                  <PointList
                    points={screen.capabilities}
                    icon={<Check className="text-burgundy size-4" />}
                  />
                </div>
              </section>
            ) : null}
            {screen.limits.length > 0 ? (
              <section className="border-lacquer/15 bg-lacquer/[0.03] rounded-2xl border p-5">
                <h3 className={subheadingClass}>{text.limits}</h3>
                <div className="mt-3">
                  <PointList
                    points={screen.limits}
                    icon={<Minus className="text-lacquer size-4" />}
                  />
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {screen.flows.length > 0 ? (
          <section>
            <h3 className={subheadingClass}>{text.flows}</h3>
            <div className="mt-3 grid gap-4">
              {screen.flows.map((flow, flowIndex) => (
                <FlowCard key={flowIndex} flow={flow} text={text} />
              ))}
            </div>
          </section>
        ) : null}

        {screen.terms.length > 0 ? (
          <section>
            <h3 className={subheadingClass}>{text.terms}</h3>
            <div className="mt-3">
              <TermList terms={screen.terms} />
            </div>
          </section>
        ) : null}

        {screen.tips.length > 0 ? (
          <section className="border-gold/40 bg-gold/10 rounded-2xl border p-5">
            <h3 className={subheadingClass}>{text.tips}</h3>
            <div className="mt-3">
              <PointList
                points={screen.tips}
                icon={<Lightbulb className="text-gold-ink size-4" />}
              />
            </div>
          </section>
        ) : null}

        <p>
          <Link
            href={href}
            className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold"
          >
            {text.open} “{screen.title}”
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      </div>
    </details>
  );
}

function Contents({
  guide,
  text,
  className,
}: {
  guide: RoleGuideView;
  text: Copy;
  className: string;
}) {
  const parts = [
    { id: "vai-tro", label: text.role },
    { id: "du-lieu", label: text.data },
    { id: "lam-quen", label: text.basics },
    ...(guide.role.workflows.length > 0
      ? [{ id: "luong-cong-viec", label: text.workflows }]
      : []),
    { id: "tung-muc", label: text.screens },
    ...(guide.role.faq.length > 0 ? [{ id: "cau-hoi", label: text.faq }] : []),
  ];

  return (
    <nav aria-label={text.contents} className={className}>
      <p className={subheadingClass}>{text.contents}</p>
      <ol className="mt-3 grid gap-1 text-sm">
        {parts.map((part, index) => (
          <li key={part.id}>
            <a
              href={`#${part.id}`}
              className="text-burgundy hover:bg-ivory/70 block rounded-lg px-2 py-1.5 font-semibold"
            >
              {index + 1}. {part.label}
            </a>
            {part.id === "tung-muc" ? (
              <ol className="border-burgundy/10 mt-1 mb-2 ml-3 grid gap-0.5 border-l pl-2">
                {guide.screens.map((screen) => (
                  <li key={screen.path}>
                    <a
                      href={`#${screenAnchor(screen.path)}`}
                      className="text-charcoal/70 hover:text-burgundy hover:bg-ivory/70 block rounded-lg px-2 py-1"
                    >
                      {screen.title}
                    </a>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AdminGuide({
  locale,
  basePath,
  roleKey,
  roleLabel,
  guide,
}: {
  locale: AdminLocale;
  basePath: Route;
  roleKey: SystemRoleKey;
  roleLabel: string;
  guide: RoleGuideView;
}) {
  const text = pageCopy[locale];
  const RoleIcon = roleIcons[roleKey];
  const hrefFor = (path: string) => `${basePath}${path}` as Route;
  const titles = new Map(
    guide.screens.map((screen) => [screen.path, screen.title]),
  );
  let part = 0;

  return (
    <div id="dau-trang" data-role={roleKey} className="scroll-mt-28">
      <GuideHashOpener />

      <div>
        <p className="eyebrow">{text.eyebrow}</p>
        <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
          {text.title}
        </h1>
        <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
          {text.lead}
        </p>
      </div>

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div lang="vi" className="grid min-w-0 gap-14">
          <section className="grid gap-5">
            <div
              id="vai-tro"
              className="bg-burgundy text-ivory relative isolate scroll-mt-28 overflow-hidden rounded-[2rem] p-7 shadow-[var(--shadow-lacquer)] md:p-10"
            >
              <div
                aria-hidden="true"
                className="border-gold/20 pointer-events-none absolute -top-32 -right-24 -z-10 size-96 rounded-full border"
              />
              <div
                aria-hidden="true"
                className="bg-lacquer/45 pointer-events-none absolute -bottom-40 -left-20 -z-10 size-96 rounded-full blur-3xl"
              />
              <p className="eyebrow eyebrow-on-lacquer">
                {text.part} {++part} · {text.role}
              </p>
              <p className="border-gold/40 bg-ivory/10 text-gold-light mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold">
                <RoleIcon aria-hidden="true" className="size-4" />
                {roleLabel}
              </p>
              <div className="text-ivory/85 mt-5 grid max-w-3xl gap-4 text-base leading-7 md:text-lg md:leading-8">
                {guide.role.intro.map((paragraph, index) => (
                  <p key={index}>
                    <Rich
                      text={paragraph}
                      strongClassName="text-gold-light font-semibold"
                    />
                  </p>
                ))}
              </div>
            </div>

            <Contents
              guide={guide}
              text={text}
              className={`${cardClass} xl:hidden`}
            />

            {guide.role.responsibilities.length > 0 ? (
              <div className={cardClass}>
                <h3 className="text-burgundy font-serif text-2xl">
                  {text.responsibilities}
                </h3>
                <div className="mt-4">
                  <PointList
                    points={guide.role.responsibilities}
                    icon={<Check className="text-burgundy size-4" />}
                  />
                </div>
              </div>
            ) : null}
          </section>

          <section className="grid gap-5">
            <PartHeading
              id="du-lieu"
              number={++part}
              title={text.data}
              lead={text.dataLead}
              text={text}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={cardClass}>
                <h3 className="text-burgundy flex items-center gap-2 font-serif text-2xl">
                  <Eye aria-hidden="true" className="size-5" />
                  {text.sees}
                </h3>
                <div className="mt-4">
                  <PointList
                    points={guide.role.sees}
                    icon={<Check className="text-burgundy size-4" />}
                  />
                </div>
              </div>
              <div className="border-lacquer/20 bg-lacquer/[0.03] rounded-2xl border p-6">
                <h3 className="text-lacquer flex items-center gap-2 font-serif text-2xl">
                  <EyeOff aria-hidden="true" className="size-5" />
                  {text.hidden}
                </h3>
                <div className="mt-4">
                  <PointList
                    points={guide.role.hidden}
                    icon={<Minus className="text-lacquer size-4" />}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5">
            <PartHeading
              id="lam-quen"
              number={++part}
              title={text.basics}
              lead={text.basicsLead}
              text={text}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {guide.basics.map((basic, index) => (
                <div key={index} className={cardClass}>
                  <h3 className="text-burgundy font-serif text-xl leading-snug">
                    <Rich text={basic.title} strongClassName="font-semibold" />
                  </h3>
                  <div className="mt-3">
                    <PointList
                      points={basic.points}
                      icon={
                        <span className="bg-gold block size-1.5 rounded-full" />
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {guide.role.workflows.length > 0 ? (
            <section className="grid gap-5">
              <PartHeading
                id="luong-cong-viec"
                number={++part}
                title={text.workflows}
                lead={text.workflowsLead}
                text={text}
              />
              <div className="grid gap-4">
                {guide.role.workflows.map((flow, index) => (
                  <FlowCard
                    key={index}
                    flow={flow}
                    text={text}
                    related={(flow.links ?? []).flatMap((path) => {
                      const label = titles.get(path);
                      return label ? [{ href: hrefFor(path), label }] : [];
                    })}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-5">
            <PartHeading
              id="tung-muc"
              number={++part}
              title={text.screens}
              lead={text.screensLead}
              text={text}
            />
            <div className="grid gap-4">
              {guide.screens.map((screen, index) => (
                <ScreenSection
                  key={screen.path}
                  screen={screen}
                  index={index}
                  href={hrefFor(screen.path)}
                  text={text}
                />
              ))}
            </div>
          </section>

          {guide.role.faq.length > 0 ? (
            <section className="grid gap-5">
              <PartHeading
                id="cau-hoi"
                number={++part}
                title={text.faq}
                text={text}
              />
              <div className="grid gap-3">
                {guide.role.faq.map((entry, index) => (
                  <details key={index} className={foldClass}>
                    <summary className="text-burgundy flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                      <span>
                        <Rich
                          text={entry.question}
                          strongClassName="font-semibold"
                        />
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className="text-charcoal/40 mt-0.5 size-5 shrink-0 transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="border-burgundy/10 text-charcoal/80 border-t px-5 py-4 text-[0.95rem] leading-7">
                      <Rich text={entry.answer} />
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          <p>
            <a
              href="#dau-trang"
              className="text-burgundy border-burgundy/30 hover:bg-ivory/70 inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold"
            >
              {text.backToTop}
            </a>
          </p>
        </div>

        <aside className="hidden xl:block">
          <Contents
            guide={guide}
            text={text}
            className={`${cardClass} sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto p-5`}
          />
        </aside>
      </div>
    </div>
  );
}
