export enum UseCaseCategory {
  PR_COMMS = "PR & Comms",
  PRODUCT = "Product",
  BRANDING = "Branding",
  MARKETING = "Marketing",
  SOCIAL_MEDIA = "Social Media",
  JOURNALISM = "Journalism"
}

export interface UseCase {
  category: UseCaseCategory;
  title: string;
  description: string;
  color: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}
