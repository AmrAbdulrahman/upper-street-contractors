// Two entry points on purpose. `ContactDetailsPanel` is shared with the Enquiry
// Wizard (a Client Component); `ContactDetailsSection` is `server-only`. This
// barrel must never re-export the section, or importing the panel from here
// would drag the CMS query layer into the browser bundle.
export { ContactDetailsPanel, type ContactDetailsProps } from "./contact-details";
