import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthSessionService } from './auth-session.service';

interface GoogleSignIn {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(element: HTMLElement, options: { theme: 'outline'; size: 'large' }): void;
  disableAutoSelect(): void;
}

let sdkPromise: Promise<GoogleSignIn> | undefined;
let credentialHandler: ((response: { credential: string }) => void) | undefined;

function googleSdk(): Promise<GoogleSignIn> {
  sdkPromise ??= new Promise<GoogleSignIn>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const failed = () => {
      script.remove();
      reject(new Error('Google Identity Services no está disponible.'));
    };
    script.onload = () => {
      const sdk = (window as Window & { google?: { accounts: { id: GoogleSignIn } } })
        .google?.accounts.id;
      if (sdk) resolve(sdk);
      else failed();
    };
    script.onerror = failed;
    document.head.append(script);
  }).catch((error: unknown) => {
    sdkPromise = undefined;
    throw error;
  });
  return sdkPromise;
}

let initializedClient: string | undefined;

@Component({
  selector: 'app-sign-in',
  imports: [RouterLink],
  template: `
    <section class="proposal-page">
      <h1>Mi cuenta</h1>
      @if (auth.session(); as session) {
        <p>{{ session.correo }}</p>
        <p>
          @if (!session.perfil_completo) {
            <a routerLink="/perfil/completar">Completar perfil</a>
          } @else {
            <a routerLink="/mis-propuestas">Mis propuestas</a>
          }
        </p>
        <button class="button-primary" type="button" (click)="logout()">Cerrar sesión</button>
      }
      <div #googleButton [hidden]="!!auth.session()"></div>
      @if (message()) {
        <p role="status">{{ message() }}</p>
      }
    </section>
  `,
})
export class SignInComponent implements AfterViewInit {
  protected readonly auth = inject(AuthSessionService);
  protected readonly message = signal('');
  private readonly button = viewChild.required<ElementRef<HTMLElement>>('googleButton');
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly destroy = inject(DestroyRef);

  private readonly receiveCredential = ({ credential }: { credential: string }) => {
    this.message.set('Ingresando…');
    this.auth.loginWithGoogle(credential).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (session) => {
        this.message.set('');
        void this.router.navigate([session.perfil_completo ? '/mis-propuestas' : '/perfil/completar']);
      },
      error: () => this.message.set('No se pudo iniciar sesión con Google. Intenta de nuevo.'),
    });
  };

  async ngAfterViewInit(): Promise<void> {
    this.destroy.onDestroy(() => {
      if (credentialHandler === this.receiveCredential) credentialHandler = undefined;
    });
    if (this.auth.token()) {
      try {
        await firstValueFrom(this.auth.loadSession());
        return;
      } catch {
        this.auth.logout();
      }
    }
    await this.renderButton();
  }

  protected logout(): void {
    this.auth.logout();
    void sdkPromise?.then((sdk) => sdk.disableAutoSelect()).catch(() => undefined);
    void this.renderButton();
  }

  private async renderButton(): Promise<void> {
    this.message.set('Cargando inicio de sesión…');
    try {
      const { clientId } = await firstValueFrom(
        this.http.get<{ clientId: string | null }>('/api/v1/auth/google/config'),
      );
      if (this.destroy.destroyed) return;
      if (!clientId) {
        this.message.set('El inicio de sesión con Google aún no está configurado.');
        return;
      }
      const sdk = await googleSdk();
      if (this.destroy.destroyed) return;
      credentialHandler = this.receiveCredential;
      if (initializedClient !== clientId) {
        sdk.initialize({
          client_id: clientId,
          callback: (response) => credentialHandler?.(response),
        });
        initializedClient = clientId;
      }
      this.button().nativeElement.replaceChildren();
      sdk.renderButton(this.button().nativeElement, { theme: 'outline', size: 'large' });
      this.message.set('');
    } catch {
      if (!this.destroy.destroyed) this.message.set('No se pudo cargar el inicio de sesión con Google.');
    }
  }
}
