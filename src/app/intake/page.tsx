import { redirect } from "next/navigation";

// The guided form was replaced by the interview chat.
export default function IntakePage() {
  redirect("/build");
}
