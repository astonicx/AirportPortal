import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto flex max-w-3xl items-center justify-center">
        <Card className="w-full border-slate-200 shadow-sm">
          <CardHeader className="space-y-4 text-center">
            <img src="/images/BDPA_edited.png" alt="BDPA Logo" className="mx-auto h-24 w-auto" />
            <CardTitle className="text-3xl font-bold text-slate-900">
              Welcome to BDPA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-slate-600">
            <p>
              This is the starter home page for the BDPA React scaffold.
            </p>
            <p>
              Your app is set up and ready for you to build from here.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
