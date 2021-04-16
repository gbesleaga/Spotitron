import { Component, OnInit, Input } from '@angular/core';

export interface MenuItem {
  text: string;
}

export interface ActionMenuItem extends MenuItem {
  action: () => void;
}

function instanceOfActionMenuItem(object: any): object is ActionMenuItem {
  return 'action' in object;
}

export interface PlaceholderMenuItem extends MenuItem {
  submenuIndex: number;
}

function instanceOfPlaceholderMenuItem(object: any): object is PlaceholderMenuItem {
  return 'submenuIndex' in object;
}

export interface Menu {
  show: boolean;
  top?: number; //px
  left?: number; //px
  right?: number; //px
  bottom?: number; //px;
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
  @Input() menu: Menu = {show: false, top: 0, left: 0, items: [], children: []};

  activeItem: PlaceholderMenuItem | undefined = undefined;
  
  constructor() { }

  ngOnInit(): void {
  }

  menuAction(item: MenuItem, e: MouseEvent) {
    e.stopPropagation();
    //console.log(item.id);
    
    if (instanceOfActionMenuItem(item)) {
      item.action();
    }
  }

  submenuOpen(item: MenuItem, e: MouseEvent) {
    e.stopPropagation();
    
    if (this.activeItem) {
      this.menu.children[this.activeItem.submenuIndex].show = false;
      this.activeItem = undefined;
    }

    if (instanceOfPlaceholderMenuItem(item)) {
      this.menu.children[item.submenuIndex].show = true;
      this.activeItem = item;
    }
  }
}


