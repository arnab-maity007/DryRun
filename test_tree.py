class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def dfs(root):
    if not root:
        return
    # The active line will highlight here as the engine steps through
    dfs(root.left)
    dfs(root.right)

def main():
    # Build a simple binary tree
    left_child = TreeNode(20, TreeNode(40), TreeNode(50))
    right_child = TreeNode(30)
    root = TreeNode(10, left_child, right_child)
    
    # Trigger recursion
    dfs(root)

if __name__ == "__main__":
    main()