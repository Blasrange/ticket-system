import { Routes } from '@angular/router';
import { Login } from './login/login';
import { authGuard } from './core/guards/auth-guard';
import { Shell } from './shell/shell';

export const routes: Routes = [
  // Ruta por defecto → login
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // Login sin layout
  {
    path: 'login',
    component: Login
  },

  // Rutas autenticadas — el Shell actúa como layout
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
      }
      // Aquí irán las demás rutas protegidas (agents, reports, settings)
      
    ]
  },
  // Comodín
  {
    path: '**',
    redirectTo: 'login'
  }
];
