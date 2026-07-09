import type { TemplateCategory } from "@/lib/types/database";

export interface DefaultTemplate {
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: "Recruiter Cold Email",
    category: "recruiter_cold_email",
    subject: "Interested in {{role}} at {{company}}",
    body: `Hi {{first_name}},

I came across the {{role}} opening at {{company}} and wanted to reach out directly. I'm a {{your_title}} with experience in {{relevant_skill}}, and I think there's a strong fit with what your team is building.

A couple of highlights:
- {{achievement_1}}
- {{achievement_2}}

I'd love to learn more about the role and share how I could contribute. Would you be open to a quick chat this week?

Best,
{{your_name}}`,
  },
  {
    name: "Hiring Manager Cold Email",
    category: "hiring_manager_cold_email",
    subject: "{{your_name}} — {{role}} at {{company}}",
    body: `Hi {{first_name}},

I noticed you lead the {{team}} team at {{company}} and saw the {{role}} opening. Rather than just apply through the portal, I wanted to reach out directly since I'm genuinely excited about the problems your team is solving.

In my current role at {{current_company}}, I {{relevant_accomplishment}}, which maps closely to what this role seems to need.

Happy to send over my resume or jump on a quick call — whichever is easier for you.

Best,
{{your_name}}`,
  },
  {
    name: "Alumni Referral Request",
    category: "alumni_referral_request",
    subject: "Fellow {{school}} alum — quick question about {{company}}",
    body: `Hi {{first_name}},

I saw we both went to {{school}} — small world! I noticed you're at {{company}}, and I'm currently applying for the {{role}} position there.

Would you be open to a 15-minute call to hear about your experience on the team? And if it feels like a good fit after that, I'd really appreciate a referral.

No worries at all if you're busy — thanks for considering it.

Best,
{{your_name}}`,
  },
  {
    name: "LinkedIn DM",
    category: "linkedin_dm",
    subject: "",
    body: `Hi {{first_name}}, I'm applying to the {{role}} role at {{company}} and would love to connect. I have a background in {{relevant_skill}} and think there's a great fit. Would you be open to a quick chat?`,
  },
  {
    name: "Follow-up After No Response",
    category: "follow_up_no_response",
    subject: "Following up: {{role}} at {{company}}",
    body: `Hi {{first_name}},

Just following up on my note from last week about the {{role}} position. I know things get busy, so no worries if this slipped through — I'm still very interested and happy to answer any questions.

Best,
{{your_name}}`,
  },
  {
    name: "Thank-You After Interview",
    category: "thank_you_after_interview",
    subject: "Thank you — {{role}} interview",
    body: `Hi {{first_name}},

Thank you for taking the time to speak with me today about the {{role}} position. I really enjoyed learning more about {{topic_discussed}} and I'm even more excited about the opportunity after our conversation.

Please let me know if there's anything else I can provide to help with the decision.

Best,
{{your_name}}`,
  },
  {
    name: "Interview Follow-up",
    category: "interview_follow_up",
    subject: "Checking in on {{role}}",
    body: `Hi {{first_name}},

I wanted to check in on the status of the {{role}} position following our interview on {{interview_date}}. I remain very enthusiastic about the opportunity and happy to provide anything further that would help.

Best,
{{your_name}}`,
  },
  {
    name: "Career Fair Follow-up",
    category: "career_fair_follow_up",
    subject: "Great meeting you at {{event_name}}",
    body: `Hi {{first_name}},

It was great meeting you at {{event_name}} — thanks for taking the time to chat about {{company}}. As mentioned, I've applied for the {{role}} position and wanted to follow up directly.

I've attached my resume for reference. Let me know if there's anything else useful to share.

Best,
{{your_name}}`,
  },
  {
    name: "Referral Thank-You",
    category: "referral_thank_you",
    subject: "Thank you for the referral!",
    body: `Hi {{first_name}},

Thank you so much for referring me for the {{role}} position at {{company}} — I really appreciate you vouching for me. I'll keep you posted on how things progress, and please let me know if there's ever anything I can do for you in return.

Best,
{{your_name}}`,
  },
  {
    name: "Application Status Check",
    category: "application_status_check",
    subject: "Checking in on my application — {{role}}",
    body: `Hi {{first_name}},

I applied for the {{role}} position on {{date_applied}} and wanted to check in on the status. I remain very interested in the opportunity and happy to provide any additional information.

Best,
{{your_name}}`,
  },
];
