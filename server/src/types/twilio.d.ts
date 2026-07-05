/** Optional SMS provider — installed only when Twilio is configured in production. */
declare module "twilio" {
  interface TwilioClient {
    messages: {
      create(opts: { body: string; from?: string; to: string }): Promise<unknown>;
    };
  }

  function twilio(accountSid: string, authToken: string): TwilioClient;
  export default twilio;
}
