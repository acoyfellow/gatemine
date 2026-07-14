declare const subject: string | null;
export const BoundaryComponent = () => (
  <section>{subject == null ? 'missing' : subject}</section>
);
