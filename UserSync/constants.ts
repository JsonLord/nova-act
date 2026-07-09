import { NavLink, UseCase, UseCaseCategory, Testimonial, FaqItem } from './types';

export const NAV_LINKS: NavLink[] = [
  { label: 'Features', href: '#features' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Accuracy', href: '#accuracy' },
  { label: 'Docs', href: '#docs' },
];

export const USE_CASES: UseCase[] = [
  {
    category: UseCaseCategory.PR_COMMS,
    title: "Brand Narratives",
    description: "Test different brand communication strategies via API to deliver the right emotional impact",
    color: "bg-purple-500"
  },
  {
    category: UseCaseCategory.PRODUCT,
    title: "Market Positioning",
    description: "Test how your target customers perceive your brand positioning and values",
    color: "bg-teal-500"
  },
  {
    category: UseCaseCategory.BRANDING,
    title: "Visual Identity",
    description: "Test how different visual brand assets and voice ideas resonate with your ideal buyer.",
    color: "bg-pink-500"
  },
  {
    category: UseCaseCategory.MARKETING,
    title: "Generate Leads",
    description: "Test marketing content in a simulation of your target customers",
    color: "bg-orange-500"
  },
  {
    category: UseCaseCategory.SOCIAL_MEDIA,
    title: "Make Content",
    description: "Test social content in simulations of your network and audience",
    color: "bg-blue-500"
  },
  {
    category: UseCaseCategory.JOURNALISM,
    title: "Capture Attention",
    description: "Test headlines, thumbnails, and article content to maximise reader attention",
    color: "bg-yellow-500"
  }
];

export const TESTIMONIALS: Testimonial[] = [];

export const FAQS: FaqItem[] = [
  {
    question: "Is the API free for developers?",
    answer: "Yes. We offer a generous free tier specifically designed for developers and hobbyists to build, test, and integrate user simulations without upfront costs."
  },
  {
    question: "What is a Focus Group?",
    answer: "A Focus Group is a simulated collective of AI personas that mirror the behaviors, preferences, and interactions of a specific real-world audience."
  },
  {
    question: "How do credits work in the free tier?",
    answer: "Credits are used to run simulations. One credit equals one simulated interaction. The developer plan includes 1,000 free credits per month, refreshing automatically."
  },
  {
    question: "Can I integrate this into my CI/CD?",
    answer: "Absolutely. Our CLI tool and API are designed to run as part of your testing pipeline, allowing you to validate UX decisions before merging code."
  },
  {
    question: "How do I get an API key?",
    answer: "You need a Huggingface token with a valid account."
  }
];