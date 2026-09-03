import HubClient from "./HubClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gaming Dojo Hub",
};

export default function HomePage() {
  return <HubClient />;
}
