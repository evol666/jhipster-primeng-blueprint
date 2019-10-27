import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';

import { ActivatedRoute, Router } from '@angular/router';
import { JhiEventManager } from 'ng-jhipster';
import { ConfirmationService, LazyLoadEvent, MessageService } from 'primeng/api';
import { ITEMS_PER_PAGE } from 'app/shared';
import {
  computeFilterMatchMode,
  lazyLoadEventToServerQueryParams,
  lazyLoadEventToRouterQueryParams,
  fillTableFromQueryParams
} from 'app/shared/util/request-util';
import { UserService, AccountService, IUser } from 'app/core';
import { Subscription } from 'rxjs';
import { Table } from 'primeng/table';
import { TranslateService } from '@ngx-translate/core';
import { switchMap, tap, filter } from 'rxjs/operators';

@Component({
  selector: 'jhi-user-mgmt',
  templateUrl: './user-management.component.html'
})
export class UserMgmtComponent implements OnInit, OnDestroy {
  currentAccount: any;
  users: IUser[];
  eventSubscriber: Subscription;

  totalItems: number;
  itemsPerPage: number;
  loading: boolean;

  private filtersDetails: { [_: string]: { matchMode?: string; flatten?: (_: any) => string; unflatten?: (_: string) => any } } = {};

  @ViewChild('userTable', { static: true })
  userTable: Table;

  constructor(
    protected userService: UserService,
    protected messageService: MessageService,
    protected accountService: AccountService,
    protected activatedRoute: ActivatedRoute,
    protected router: Router,
    protected eventManager: JhiEventManager,
    protected confirmationService: ConfirmationService,
    protected translateService: TranslateService
  ) {
    this.itemsPerPage = ITEMS_PER_PAGE;
    this.loading = true;
  }

  ngOnInit() {
    this.accountService.identity().then(account => {
      this.currentAccount = account;
    });
    this.registerChangeInUsers();
    this.activatedRoute.queryParams
      .pipe(
        tap(queryParams => fillTableFromQueryParams(this.userTable, queryParams, this.filtersDetails)),
        tap(() => (this.loading = true)),
        switchMap(() => this.userService.query(lazyLoadEventToServerQueryParams(this.userTable.createLazyLoadMetadata()))),
        filter((res: HttpResponse<IUser[]>) => res.ok)
      )
      .subscribe(
        (res: HttpResponse<IUser[]>) => {
          this.paginateUsers(res.body, res.headers);
          this.loading = false;
        },
        (res: HttpErrorResponse) => {
          this.onError(res.message);
          this.loading = false;
        }
      );
  }

  ngOnDestroy() {
    this.eventManager.destroy(this.eventSubscriber);
  }

  onLazyLoadEvent(event: LazyLoadEvent) {
    const queryParams = lazyLoadEventToRouterQueryParams(event, this.filtersDetails);
    this.router.navigate(['/admin/user-management'], { queryParams });
  }

  filter(value, field) {
    this.userTable.filter(value, field, computeFilterMatchMode(this.filtersDetails[field]));
  }

  delete(login: string) {
    this.confirmationService.confirm({
      header: this.translateService.instant('entity.delete.title'),
      message: this.translateService.instant('userManagement.delete.question', { login }),
      accept: () => {
        this.userService.delete(login).subscribe(() => {
          this.eventManager.broadcast({
            name: 'userListModification',
            content: 'Deleted a user'
          });
        });
      }
    });
  }

  trackId(index: number, item: IUser) {
    return item.login;
  }

  registerChangeInUsers() {
    this.eventSubscriber = this.eventManager.subscribe('userListModification', () => {});
  }

  setActive(user, isActivated) {
    user.activated = isActivated;
    this.userService.update(user).subscribe();
  }

  protected paginateUsers(data: IUser[], headers: HttpHeaders) {
    this.totalItems = parseInt(headers.get('X-Total-Count'), 10);
    this.users = data;
  }

  protected onError(errorMessage: string) {
    this.messageService.add({ severity: 'error', summary: errorMessage });
  }
}