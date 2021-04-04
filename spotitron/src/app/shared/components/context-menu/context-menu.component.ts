import { Component, OnInit, Input } from '@angular/core';

export enum MenuItemType {
  ACTION,
  PLACEHOLDER
}

export interface MenuItem {
  id: number;
  text: string;
  type: MenuItemType;
  action: () => void;
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
  
  constructor() { }

  ngOnInit(): void {
  }

  menuAction(item: MenuItem, e: MouseEvent) {
    e.stopPropagation();
    //console.log(item.id);
    
    if (item.type === MenuItemType.ACTION) {
      item.action();
    }
  }
}
