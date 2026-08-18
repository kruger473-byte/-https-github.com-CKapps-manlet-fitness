import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor, formatMoney } from "@/lib/entitlements";
import { BookingForm } from "@/components/booking-form";
import { bookSlotAction } from "./actions";
import {
  PageHeader,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Stat,
  Alert,
} from "@/components/ui";

export const metadata: Metadata = { title: "Coaching" };
export const dynamic = "force-dynamic";

export default async function CoachingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const entitlement = entitlementFor(user.subscriptions);

  const isCoach = Boolean(user.coachProfile);

  const [coaches, mySessions, coachSessions] = await Promise.all([
    db.coachProfile.findMany({
      where: { isAcceptingClients: true },
      include: {
        user: true,
        slots: {
          where: { isBooked: false, startsAt: { gte: new Date() } },
          orderBy: { startsAt: "asc" },
          take: 8,
        },
      },
    }),
    db.coachingSession.findMany({
      where: { clientId: user.id },
      orderBy: { startsAt: "desc" },
      include: { coach: { include: { user: true } } },
      take: 10,
    }),
    isCoach
      ? db.coachingSession.findMany({
          where: { coachId: user.coachProfile!.id },
          orderBy: { startsAt: "asc" },
          include: { client: true },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  const upcoming = mySessions.filter(
    (s) => s.status === "SCHEDULED" && s.startsAt >= new Date(),
  );
  const past = mySessions.filter(
    (s) => s.status !== "SCHEDULED" || s.startsAt < new Date(),
  );

  return (
    <>
      <PageHeader
        eyebrow="1-1 coaching"
        title={isCoach ? "Your coaching schedule" : "Book a coach"}
        description={
          isCoach
            ? "Sessions your clients have booked. Each one has a private classroom that persists between calls."
            : "A 45-minute call in a private classroom. Bring your numbers and a video of a working set — you'll get more out of it."
        }
      />

      {/* Coach view --------------------------------------------------- */}
      {isCoach ? (
        <section className="mb-10">
          <h2 className="mb-3 text-base font-semibold">Booked sessions</h2>
          {coachSessions.length === 0 ? (
            <EmptyState
              title="No sessions booked yet"
              description="Once members book your open slots they'll appear here with their agenda and goals."
            />
          ) : (
            <div className="space-y-3">
              {coachSessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/coaching/room/${s.roomCode}`}
                  className="card flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-volt-500/40"
                >
                  <div>
                    <p className="text-sm font-medium">{s.client.name}</p>
                    <p className="text-xs text-ink-400">
                      {s.startsAt.toLocaleString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {s.agenda ? (
                      <p className="mt-1 text-xs text-ink-300">{s.agenda}</p>
                    ) : null}
                  </div>
                  <Badge tone={s.status === "SCHEDULED" ? "info" : "neutral"}>
                    {s.status.toLowerCase()}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* Member view -------------------------------------------------- */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Credits available"
          value={String(entitlement.coachingCreditsLeft)}
          sub={entitlement.includesCoaching ? "resets each period" : "Elite plan includes 2/month"}
          tone={entitlement.coachingCreditsLeft > 0 ? "good" : "neutral"}
        />
        <Stat label="Upcoming" value={String(upcoming.length)} sub="scheduled sessions" />
        <Stat label="Completed" value={String(past.length)} sub="past sessions" />
      </div>

      {!entitlement.includesCoaching ? (
        <div className="mb-8">
          <Alert tone="info">
            1-1 coaching is included with Elite (2 calls a month).{" "}
            <Link href="/account/billing" className="font-medium underline">
              Compare plans
            </Link>
            .
          </Alert>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-base font-semibold">Your upcoming sessions</h2>
          <div className="space-y-3">
            {upcoming.map((s) => (
              <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">with {s.coach.user.name}</p>
                  <p className="text-xs text-ink-400">
                    {s.startsAt.toLocaleString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {s.agenda ? (
                    <p className="mt-1.5 text-xs text-ink-300">{s.agenda}</p>
                  ) : null}
                </div>
                <ButtonLink href={`/coaching/room/${s.roomCode}`}>
                  Enter classroom
                </ButtonLink>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-base font-semibold">Available coaches</h2>
        <div className="space-y-6">
          {coaches.map((coach) => {
            const specialties = JSON.parse(coach.specialties) as string[];
            return (
              <Card key={coach.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold">{coach.user.name}</h3>
                    <p className="text-sm text-volt-500">{coach.headline}</p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-400">
                      {coach.bio}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {specialties.map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatMoney(coach.rateCents)}</p>
                    <p className="text-xs text-ink-400">per 45-min session</p>
                  </div>
                </div>

                <div className="mt-5 border-t border-ink-800 pt-5">
                  {coach.slots.length === 0 ? (
                    <p className="text-sm text-ink-400">
                      No open slots right now. Check back next week.
                    </p>
                  ) : (
                    <BookingForm
                      action={bookSlotAction}
                      canBook={entitlement.coachingCreditsLeft > 0}
                      slots={coach.slots.map((s) => ({
                        id: s.id,
                        label: s.startsAt.toLocaleString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      }))}
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}
