import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AccessControlService } from './access-control.service.js';
import { ResourceOwnershipService } from './resource-ownership.service.js';
import type { SessionRequest } from './session-request.js';

@Injectable()
export class ActiveAccountGuard implements CanActivate {
  constructor(private readonly accessControl: AccessControlService) {}

  canActivate(context: ExecutionContext): boolean {
    this.accessControl.assertActive(
      context.switchToHttp().getRequest<SessionRequest>().sesion,
    );
    return true;
  }
}

@Injectable()
export class ProposerGuard implements CanActivate {
  constructor(private readonly accessControl: AccessControlService) {}

  canActivate(context: ExecutionContext): boolean {
    this.accessControl.assertCanPropose(
      context.switchToHttp().getRequest<SessionRequest>().sesion,
    );
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly accessControl: AccessControlService) {}

  canActivate(context: ExecutionContext): boolean {
    this.accessControl.assertAdmin(
      context.switchToHttp().getRequest<SessionRequest>().sesion,
    );
    return true;
  }
}

@Injectable()
export class ProposalOwnerGuard implements CanActivate {
  constructor(
    private readonly accessControl: AccessControlService,
    private readonly ownership: ResourceOwnershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    this.accessControl.assertActive(request.sesion);
    const id = (await new ParseUUIDPipe().transform(request.params.id, {
      type: 'param',
      data: 'id',
    })) as string;
    await this.ownership.assertProposalOwner(request.sesion, id);
    return true;
  }
}

@Injectable()
export class ActivityOwnerGuard implements CanActivate {
  constructor(
    private readonly accessControl: AccessControlService,
    private readonly ownership: ResourceOwnershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    this.accessControl.assertActive(request.sesion);
    const id = (await new ParseUUIDPipe().transform(request.params.id, {
      type: 'param',
      data: 'id',
    })) as string;
    await this.ownership.assertActivityOwner(request.sesion, id);
    return true;
  }
}
