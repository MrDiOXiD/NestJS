import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SocksProxyAgent } = require('socks-proxy-agent');// import { SocksProxyAgent } from 'socks-proxy-agent';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string | undefined;
  picture: string | undefined;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not set in the environment.');
    }
    this.clientId = clientId;

const proxy =
  process.env.NODE_ENV !== 'production'
    ? process.env.GOOGLE_PROXY?.trim()
    : undefined;    this.client = new OAuth2Client({
      clientId,
      ...(proxy
        ? {
            transporterOptions: {
              agent: new SocksProxyAgent(proxy)
              // SOCKS: agent: new SocksProxyAgent('socks5://127.0.0.1:10808'),
            },
          }
        : {}),
    });

    this.logger.log(
      `Google client initialised (${clientId.slice(0, 12)}...)` +
        (proxy ? ` via proxy ${proxy}` : ' without proxy'),
    );
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    let ticket;
    try {
      ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
    } catch (err) {
      this.logger.error(
        `Google verifyIdToken failed: ${(err as Error).message.slice(0, 300)}`,
      );
      throw new UnauthorizedException('Invalid Google token.');
    }

    const payload: TokenPayload | undefined = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedException('Invalid Google token.');
    }

    if (!payload.email || !payload.email_verified) {

      throw new UnauthorizedException('Google account email is not verified.');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  }
}