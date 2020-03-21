// Pretty sure we can just use a number for this...
export class Reference {
  /*
  """
  HDF5 Reference.
  """
  */
  constructor(public address_of_reference: any) {}

  __bool__() {
    return this.address_of_reference != 0;
  }
}
