import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[contextMenuHost]',
})
export class ContextMenuDirective {
  constructor(public viewContainerRef: ViewContainerRef) { }
}