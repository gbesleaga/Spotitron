import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';

export interface MenuItem {
  id: number;
  text: string;
}

export interface Menu {
  top: number; //px
  left: number; //px
  items: MenuItem[];
  children: Menu[];
}

export interface MenuDisplayer {
  menu: Menu;
}

@Component({
  selector: 'app-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.css']
})
export class ContextMenuComponent implements OnInit, MenuDisplayer {
  @Input() menu: Menu = {top: 0, left: 0, items: [], children: []};

  //@Output() newMenuEvent = new EventEmitter<number>();
  
  constructor() { }

  ngOnInit(): void {
  }

  menuAction(id: number, e: MouseEvent) {
    e.stopPropagation();
    console.log(id);
  }
}
