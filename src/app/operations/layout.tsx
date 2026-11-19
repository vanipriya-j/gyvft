import "@/components/customer/application.css";
import "@/components/operations/operations.css";
export const metadata = {
  title: "GYVFT operations",
  robots: { index: false, follow: false },
};
export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="gyvft-app">{children}</div>;
}
