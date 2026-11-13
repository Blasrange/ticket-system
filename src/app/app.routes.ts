import { Routes } from '@angular/router';
import { Login } from './login/login';
import { authGuard } from './core/guards/auth-guard';
import { Shell } from './shell/shell';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: Login
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./home/home').then(m => m.Home)
      },
      {
        path: 'tickets',
        loadComponent: () => import('./tickets/tickets').then(m => m.Tickets)
      },
      {
        path: 'tickets/:id',
        loadComponent: () => import('./tickets/ticket-detail/ticket-detail').then(m => m.TicketDetail)
      },
      {
        path: 'agents',
        loadComponent: () => import('./agents/agents').then(m => m.Agents)
      },
      {
        path: 'kanban-board',
        loadComponent: () => import('./kanban-board/kanban-board').then(m => m.KanbanBoard)
      },
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];