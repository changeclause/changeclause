export interface NewsletterStore {
  put(email: string): Promise<void>;
}
