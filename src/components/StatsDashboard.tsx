import { useMemo } from "react";
import { Article, ConferenceSchedule } from "@/lib/conference";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface StatsDashboardProps {
  articles: Article[];
  schedule: ConferenceSchedule | null;
}

const COLORS = [
  "hsl(220, 70%, 50%)", "hsl(0, 72%, 51%)", "hsl(152, 60%, 42%)",
  "hsl(25, 95%, 55%)", "hsl(240, 60%, 55%)", "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)", "hsl(180, 70%, 45%)", "hsl(330, 70%, 55%)",
  "hsl(100, 60%, 40%)",
];

const StatsDashboard = ({ articles, schedule }: StatsDashboardProps) => {
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    articles.forEach((a) => {
      const cat = a.category || "Non classé";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [articles]);

  const byStatus = useMemo(() => [
    { name: "Acceptés", value: articles.filter((a) => a.status === "accepted").length, color: "hsl(152, 60%, 42%)" },
    { name: "Soumis", value: articles.filter((a) => a.status === "submitted").length, color: "hsl(38, 92%, 50%)" },
    { name: "Rejetés", value: articles.filter((a) => a.status === "rejected").length, color: "hsl(0, 72%, 51%)" },
  ].filter((d) => d.value > 0), [articles]);

  const roomOccupancy = useMemo(() => {
    if (!schedule) return [];
    const roomMinutes: Record<string, number> = {};
    schedule.rooms.forEach((r) => { roomMinutes[r] = 0; });
    schedule.slots.forEach((s) => {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      const dur = (eh * 60 + em) - (sh * 60 + sm);
      roomMinutes[s.room] = (roomMinutes[s.room] || 0) + dur;
    });
    const totalAvail = (schedule.endHour - schedule.startHour) * 60 * schedule.days;
    return Object.entries(roomMinutes).map(([room, mins]) => ({
      name: room,
      occupation: Math.round((mins / totalAvail) * 100),
      minutes: mins,
    }));
  }, [schedule]);

  if (articles.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl shadow-card p-6 space-y-6">
      <h2 className="font-display font-semibold text-foreground text-lg">📊 Statistiques</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Status pie */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Taux d'acceptation</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {byStatus.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Articles by category */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Articles par thématique</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCategory} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Room occupancy */}
        {roomOccupancy.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Occupation des salles</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={roomOccupancy} margin={{ left: 0, right: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="occupation" radius={[4, 4, 0, 0]}>
                  {roomOccupancy.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsDashboard;
