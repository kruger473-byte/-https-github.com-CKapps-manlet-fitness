import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClassroomChat, CoachNotes } from "@/components/classroom";
import { postClassroomMessageAction, saveCoachNotesAction } from "../../actions";
import { PageHeader, Badge, Card, Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Classroom" };
export const dynamic = "force-dynamic";

export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const session = await db.coachingSession.findUnique({
    where: { roomCode },
    include: {
      coach: { include: { user: true } },
      client: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) notFound();

  // Only the two participants can see a private classroom.
  const isCoach = session.coach.userId === user.id;
  const isClient = session.clientId === user.id;
  if (!isCoach && !isClient) notFound();

  const authorNames = new Map([
    [session.coach.userId, session.coach.user.name],
    [session.clientId, session.client.name],
  ]);

  const now = new Date();
  const isLive = session.startsAt <= now && session.endsAt >= now;
  const isPast = session.endsAt < now;
  const minutesUntil = Math.round((session.startsAt.getTime() - now.getTime()) / 60000);

  return (
    <>
      <Link href="/coaching" className="text-sm text-ink-400 hover:text-ink-100">
        ← Coaching
      </Link>

      <div className="mt-4">
        <PageHeader
          eyebrow={isCoach ? `Client: ${session.client.name}` : `Coach: ${session.coach.user.name}`}
          title="Private classroom"
          description={session.startsAt.toLocaleString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
          action={
            isLive ? (
              <Badge tone="success">Live now</Badge>
            ) : isPast ? (
              <Badge>Finished</Badge>
            ) : (
              <Badge tone="info">
                {minutesUntil > 1440
                  ? `in ${Math.round(minutesUntil / 1440)} days`
                  : `in ${Math.max(0, minutesUntil)} min`}
              </Badge>
            )
          }
        />
      </div>

      <div className="mb-6">
        <Alert tone={isLive ? "success" : "info"}>
          {isLive ? (
            <>
              Your call window is open. Join the video call on the link your coach
              shares in the chat below — the room, agenda and notes stay here
              afterwards.
            </>
          ) : (
            <>
              Video calls run on whichever tool you both prefer; drop the link in the
              chat. Everything else — agenda, goals, notes and messages — lives here
              permanently, so nothing is lost between calls.
            </>
          )}
        </Alert>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ClassroomChat
            sessionId={session.id}
            currentUserId={user.id}
            action={postClassroomMessageAction}
            messages={session.messages.map((m) => ({
              id: m.id,
              authorId: m.authorId,
              authorName: authorNames.get(m.authorId) ?? "Member",
              body: m.body,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold">Session brief</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-400">Agenda</dt>
                <dd className="mt-0.5 text-ink-300">
                  {session.agenda ?? "Not set yet."}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-400">
                  Client goal
                </dt>
                <dd className="mt-0.5 text-ink-300">
                  {session.clientGoals ?? "Not set yet."}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-400">
                  Duration
                </dt>
                <dd className="mt-0.5 text-ink-300">
                  {Math.round(
                    (session.endsAt.getTime() - session.startsAt.getTime()) / 60000,
                  )}{" "}
                  minutes
                </dd>
              </div>
            </dl>
          </Card>

          {isCoach ? (
            <CoachNotes
              sessionId={session.id}
              initialNotes={session.coachNotes ?? ""}
              action={saveCoachNotesAction}
            />
          ) : session.coachNotes ? (
            <Card>
              <h2 className="text-sm font-semibold">Notes from your coach</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-300">
                {session.coachNotes}
              </p>
            </Card>
          ) : (
            <Card>
              <h2 className="text-sm font-semibold">Notes from your coach</h2>
              <p className="mt-2 text-sm text-ink-400">
                Your coach will write up the session here afterwards.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
