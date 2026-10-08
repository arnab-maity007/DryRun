import sys
import json
import runpy
import os

class DryRunEngine:
    def __init__(self, target_filepath):
        self.target_filepath = os.path.abspath(target_filepath)
        # Prevent outputting state for the same line multiple times in a row
        self.last_line = -1 

    def trace_dispatcher(self, frame, event, arg):
        """
        This is the core hook. Python calls this for every event (call, line, return).
        """
        # 1. Ignore Python internal libraries (we only want the user's code)
        if frame.f_code.co_filename != self.target_filepath:
            return None

        # 2. On every new line executed, capture the state
        if event == 'line':
            line_no = frame.f_lineno
            if line_no != self.last_line:
                self.emit_state(frame, line_no)
                self.last_line = line_no
            
        # 3. Return the dispatcher itself to keep tracing inside function calls
        return self.trace_dispatcher

    def serialize_value(self, value, visited=None, depth=0, max_depth=3):
        """
        Recursively unpacks objects into JSON-safe dictionaries.
        Limits depth and tracks visited memory addresses to prevent infinite loops.
        """
        if visited is None:
            visited = set()
            
        # 1. Primitives: Return as-is
        if isinstance(value, (int, float, str, bool, type(None))):
            return value
            
        obj_id = id(value)
        
        # 2. Cycle Detection: If we've seen this exact memory address, stop.
        if obj_id in visited:
            return f"[Circular Reference to {type(value).__name__}]"
            
        # 3. Depth Limit: Stop unpacking if the tree is massive
        if depth >= max_depth:
            return f"[Max Depth Reached: {type(value).__name__}]"
            
        visited.add(obj_id)
        
        # 4. Built-in Iterables
        if isinstance(value, list):
            return [self.serialize_value(item, visited, depth + 1, max_depth) for item in value]
        if isinstance(value, dict):
            return {str(k): self.serialize_value(v, visited, depth + 1, max_depth) for k, v in value.items()}
            
        # 5. Custom Objects (TreeNode, ListNode, etc.)
        if hasattr(value, '__dict__'):
            # Create a structured dictionary describing the object
            obj_state = {
                "__type__": type(value).__name__,
                "__id__": obj_id  # Crucial for the frontend to draw connecting lines
            }
            
            # Loop through all attributes (e.g., .val, .left, .right, .next)
            for attr_name, attr_val in vars(value).items():
                if not attr_name.startswith('__'):
                    obj_state[attr_name] = self.serialize_value(attr_val, visited, depth + 1, max_depth)
                    
            return obj_state
            
        # Fallback for unparseable C-bindings or weird types
        return f"[{type(value).__name__} Object]"

    def extract_variables(self, frame):
        variables = {}
        current_frame = frame
        
        while current_frame:
            if current_frame.f_code.co_filename == self.target_filepath:
                func_name = current_frame.f_code.co_name
                if func_name == '<module>':
                    func_name = 'main'
                    
                for var_name, var_value in current_frame.f_locals.items():
                    if var_name.startswith('__'):
                        continue
                        
                    var_type = type(var_value).__name__
                    
                    # FIX: Ignore functions, classes, and built-ins
                    if var_type in ['function', 'type', 'module', 'builtin_function_or_method']:
                        continue
                        
                    display_name = var_name if current_frame == frame else f"{func_name}.{var_name}"
                    
                    if display_name not in variables:
                        serialized_data = self.serialize_value(var_value)
                        variables[display_name] = {
                            "value": serialized_data,
                            "type": var_type
                        }
                        
            current_frame = current_frame.f_back
            
        return variables

    def extract_call_stack(self, frame):
        """
        Walks backward through the frames to build the function call stack.
        """
        stack = []
        current_frame = frame
        
        while current_frame:
            # Only include functions from the user's file
            if current_frame.f_code.co_filename == self.target_filepath:
                func_name = current_frame.f_code.co_name
                # Python calls the global scope '<module>'. Rename it to 'main' for clarity.
                if func_name == '<module>':
                    func_name = 'main'
                stack.append(func_name)
                
            current_frame = current_frame.f_back
            
        # Reverse so 'main' is at index 0, and the deepest call is at the end
        return stack[::-1] 

    def emit_state(self, frame, line_no):
        """
        Packages the memory and prints it as JSON for Node.js to consume.
        """
        variables = self.extract_variables(frame)
        call_stack = self.extract_call_stack(frame)
        
        state = {
            "lineNumber": line_no,
            "variables": variables,
            "callStack": call_stack
        }
        
        # Print JSON payload as a single line
        print(json.dumps(state))
        
        # CRITICAL: Flush stdout so Node.js receives it instantly 
        # without waiting for the buffer to fill
        sys.stdout.flush() 

def run_script(filepath):
    engine = DryRunEngine(filepath)
    
    # Attach our engine to Python's execution thread
    sys.settrace(engine.trace_dispatcher)
    
    try:
        # run_path executes the script in the same memory space
        runpy.run_path(filepath, run_name="__main__")
    except Exception as e:
        # Catch any errors in the user's code and send them as a special state
        print(json.dumps({
            "error": str(e),
            "lineNumber": sys.exc_info()[2].tb_next.tb_lineno if sys.exc_info()[2].tb_next else 0
        }))
        sys.stdout.flush()
    finally:
        # Always detach the tracer when done
        sys.settrace(None)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
        
    target_file = sys.argv[1]
    run_script(target_file)