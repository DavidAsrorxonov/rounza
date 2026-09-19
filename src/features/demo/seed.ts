import { type DemoApplication, type DemoData, offsetDay } from "./model";

// Entirely fictional. No companies, people, messages, or credentials are imported.
export function createDemoData(): DemoData {
  const seeds: Pick<
    DemoApplication,
    "id" | "company" | "role" | "status" | "color" | "location" | "salary"
  >[] = [
    {
      id: "northstar",
      company: "Northstar",
      role: "Senior Product Designer",
      status: "Interviewing",
      color: "lilac",
      location: "Remote · United States",
      salary: "$140k – $165k",
    },
    {
      id: "meridian",
      company: "Meridian",
      role: "Product Designer",
      status: "Interviewing",
      color: "peach",
      location: "New York · Hybrid",
      salary: "$125k – $150k",
    },
    {
      id: "canvas",
      company: "Canvas",
      role: "Design Systems Designer",
      status: "Interviewing",
      color: "blue",
      location: "Remote · Europe",
      salary: "€75k – €95k",
    },
    {
      id: "orbit",
      company: "Orbit Labs",
      role: "Senior UX Designer",
      status: "Applied",
      color: "mint",
      location: "Austin · Hybrid",
      salary: "$130k – $155k",
    },
    {
      id: "lightwell",
      company: "Lightwell",
      role: "Product Designer",
      status: "Applied",
      color: "yellow",
      location: "London · Hybrid",
      salary: "£65k – £80k",
    },
    {
      id: "forma",
      company: "Forma Studio",
      role: "Brand & Product Designer",
      status: "Saved",
      color: "slate",
      location: "Remote · Worldwide",
      salary: "$100k – $130k",
    },
    {
      id: "kindred",
      company: "Kindred Health",
      role: "Senior Product Designer",
      status: "Saved",
      color: "peach",
      location: "San Francisco · Hybrid",
      salary: "$145k – $170k",
    },
    {
      id: "folio",
      company: "Folio",
      role: "Product Designer",
      status: "Offer",
      color: "mint",
      location: "Remote · United States",
      salary: "$135k – $150k",
    },
    {
      id: "sonder",
      company: "Sonder",
      role: "UX Designer",
      status: "Rejected",
      color: "lilac",
      location: "Berlin · On-site",
      salary: "€65k – €80k",
    },
    {
      id: "relay",
      company: "Relay",
      role: "Product Designer",
      status: "Withdrawn",
      color: "slate",
      location: "Seattle · On-site",
      salary: "$115k – $140k",
    },
  ];
  const applications: DemoApplication[] = seeds.map((seed, index) => ({
    ...seed,
    addedOn: offsetDay(-14 + index),
    description: `Help shape thoughtful digital experiences at ${seed.company}. Work with product and engineering to explore customer problems, prototype ideas, and deliver accessible, well-crafted interfaces.\n\nWhat this sample role looks for:\n• Strong interaction and visual design skills\n• Experience collaborating with engineers\n• A portfolio that explains decisions and outcomes\n• Comfort running research and usability sessions`,
    notes: "",
    contact: null,
    rounds: [],
    tasks: [],
    history: [
      {
        id: `${seed.id}-added`,
        text: "Added to your applications",
        date: offsetDay(-14 + index),
      },
    ],
  }));
  const northstar = applications[0];
  northstar.notes =
    "The team cares about clear thinking, not just polished screens. Lead with the onboarding case study and leave room for questions.";
  northstar.contact = {
    name: "Jamie Chen",
    role: "Talent partner",
    email: "jamie.chen@example.com",
  };
  northstar.rounds = [
    {
      id: "screen",
      title: "Recruiter conversation",
      kind: "Screening",
      state: "Completed",
      scheduledAt: `${offsetDay(-7)}T10:00`,
      duration: "30 min",
      description:
        "Discussed the role, team structure, and what a great first six months would look like.",
    },
    {
      id: "manager",
      title: "Meet the design lead",
      kind: "Interview",
      state: "Completed",
      scheduledAt: `${offsetDay(-3)}T14:00`,
      duration: "45 min",
      description:
        "Talked through collaboration with product and engineering. Next: a deeper look at the portfolio.",
    },
    {
      id: "portfolio",
      title: "Portfolio review",
      kind: "Interview",
      state: "Scheduled",
      scheduledAt: `${offsetDay(1)}T14:30`,
      duration: "60 min",
      description:
        "Walk through two projects. Focus on the problem, your decisions, and what changed for users.",
    },
    {
      id: "team",
      title: "Team conversation",
      kind: "Interview",
      state: "Planned",
      scheduledAt: null,
      duration: "45 min",
      description:
        "Meet your potential product and engineering partners. Timing to be confirmed.",
    },
    {
      id: "final",
      title: "Final conversation",
      kind: "Decision",
      state: "Planned",
      scheduledAt: null,
      duration: "30 min",
      description: "A final conversation about expectations and next steps.",
    },
  ];
  northstar.tasks = [
    {
      id: "portfolio-task",
      title: "Polish the onboarding case study",
      dueOn: offsetDay(0),
      done: false,
    },
    {
      id: "questions",
      title: "Prepare questions for the design team",
      dueOn: offsetDay(1),
      done: false,
    },
    {
      id: "confirm",
      title: "Confirm portfolio review availability",
      dueOn: offsetDay(-1),
      done: true,
    },
  ];
  northstar.history.unshift({
    id: "portfolio-invite",
    text: "Portfolio review scheduled",
    date: offsetDay(-2),
  });
  applications[1].rounds = [
    {
      id: "screen",
      title: "Introductory call",
      kind: "Screening",
      state: "Completed",
      scheduledAt: `${offsetDay(-4)}T11:00`,
      duration: "30 min",
      description: "An introduction to the product and design team.",
    },
    {
      id: "assessment",
      title: "Design exercise discussion",
      kind: "Assessment",
      state: "Scheduled",
      scheduledAt: `${offsetDay(2)}T11:00`,
      duration: "60 min",
      description:
        "Share your approach to the sample exercise and discuss trade-offs.",
    },
  ];
  applications[1].tasks = [
    {
      id: "exercise",
      title: "Review the design exercise brief",
      dueOn: offsetDay(1),
      done: false,
    },
  ];
  applications[1].contact = {
    name: "Sam Morgan",
    role: "Design manager",
    email: "sam.morgan@example.com",
  };
  applications[2].rounds = [
    {
      id: "system",
      title: "Design systems deep dive",
      kind: "Interview",
      state: "Scheduled",
      scheduledAt: `${offsetDay(4)}T15:00`,
      duration: "45 min",
      description:
        "Bring a component example and talk through accessibility and adoption.",
    },
  ];
  applications[2].tasks = [
    {
      id: "components",
      title: "Choose a design system case study",
      dueOn: offsetDay(3),
      done: false,
    },
  ];
  applications[3].tasks = [
    {
      id: "follow-up",
      title: "Follow up on your application",
      dueOn: offsetDay(-1),
      done: false,
    },
  ];
  applications[5].tasks = [
    {
      id: "tailor",
      title: "Tailor your portfolio introduction",
      dueOn: offsetDay(5),
      done: false,
    },
  ];
  applications[7].notes =
    "Offer received. Keep the interview notes here to help compare the role with other opportunities.";
  applications[7].history.unshift({
    id: "offer",
    text: "Offer received",
    date: offsetDay(-1),
  });
  return { version: 1, applications };
}
