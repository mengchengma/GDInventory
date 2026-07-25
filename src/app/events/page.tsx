import EventsClient from "./EventsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gaming Dojo Events",
};

export default function EventsPage() {
  return <EventsClient />;
}
