class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def main():
    # Step 1: Create individual nodes
    node3 = ListNode(30)
    node2 = ListNode(20, node3)
    head = ListNode(10, node2)
    
    # Step 2: Traverse the list
    curr = head
    while curr:
        print(f"Visiting node: {curr.val}")
        curr = curr.next

if __name__ == "__main__":
    main()